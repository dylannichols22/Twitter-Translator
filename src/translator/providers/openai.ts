import type {
  BreakdownContext,
  BreakdownResult,
  QuickStreamCallbacks,
  QuickTranslation,
  StreamCallbacks,
  TranslatedTweet,
  TranslationProvider,
  UsageStats,
} from './types';
import type { Tweet } from '../../scraper';

function extractJson(text: string): string {
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }
  return jsonText;
}

function extractQuickTranslations(text: string): QuickTranslation[] {
  const translations: QuickTranslation[] = [];
  const regex = /\{\s*"id"\s*:\s*"([^"]*)"\s*,\s*"naturalTranslation"\s*:\s*"([^"]*)"\s*\}/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    translations.push({
      id: match[1],
      naturalTranslation: match[2],
    });
  }

  return translations;
}

interface QuickTranslationApiResponse {
  translations: QuickTranslation[];
}

function parseQuickTranslationResponse(jsonText: string): QuickTranslation[] {
  const parsed = JSON.parse(jsonText) as QuickTranslationApiResponse;
  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('Invalid quick translation response');
  }
  return parsed.translations.filter((t) => t?.id && t?.naturalTranslation);
}

const QUICK_SYSTEM_PROMPT = `You are a Chinese language expert. Translate the provided Chinese tweets into natural, fluent English.

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "translations": [
    { "id": "tweet_id", "naturalTranslation": "Natural English translation" }
  ]
}`;

const BREAKDOWN_SYSTEM_PROMPT = `You are a Chinese language expert helping English speakers learn Chinese.

For the provided Chinese text, you must return:
1. Segmentation into meaningful units (as a native speaker would parse it)
2. Pinyin with tone marks (e.g., jīntiān, not jintion1)
3. Word-by-word gloss/meaning
4. Notes about cultural context, internet slang, idioms, or learning tips. Only include notes when they add real learning value; otherwise return an empty notes array.
5. Segment by sentence boundaries where possible. Include sentence-ending punctuation (e.g., 。！？) with the final segment of the sentence.
6. If the text includes profanity, insults, or slurs, explain them neutrally for learning. Do not add moral judgments, safety warnings, or lecturing; keep notes focused on meaning, register, and usage. Do not mask or censor the words; keep them in the gloss so the learner can map meaning accurately.

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "segments": [
    { "chinese": "今天", "pinyin": "jīntiān", "gloss": "today" }
  ],
  "notes": ["Any relevant cultural or linguistic notes"]
}`;

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements TranslationProvider {
  readonly name = 'openai';
  readonly model = 'gpt-4o-mini';
  private baseUrl = 'https://api.openai.com/v1';

  async translateQuickStreaming(
    tweets: Tweet[],
    apiKey: string,
    callbacks: QuickStreamCallbacks
  ): Promise<void> {
    const { signal } = callbacks;

    if (signal?.aborted) {
      return;
    }

    if (!apiKey) {
      callbacks.onError(new Error('API key is required'));
      return;
    }

    if (tweets.length === 0) {
      callbacks.onError(new Error('No tweets to translate'));
      return;
    }

    const tweetsForTranslation = tweets.map((t) => ({
      id: t.id,
      text: t.text,
    }));

    const userPrompt = `Translate these Chinese tweets:\n\n${JSON.stringify(tweetsForTranslation, null, 2)}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: QUICK_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2048,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullText = '';
      const seenIds = new Set<string>();
      let usage: UsageStats = { inputTokens: 0, outputTokens: 0 };

      const decoder = new TextDecoder();

      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as OpenAIStreamChunk;
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullText += content;

                const jsonText = extractJson(fullText);
                const translations = extractQuickTranslations(jsonText);

                for (const translation of translations) {
                  if (!seenIds.has(translation.id) && !signal?.aborted) {
                    seenIds.add(translation.id);
                    callbacks.onTranslation(translation);
                  }
                }
              }

              if (parsed.usage) {
                usage = {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens,
                };
              }
            } catch {
              // Ignore parse errors for individual chunks
            }
          }
        }
      }

      if (signal?.aborted) return;

      // Try to parse any remaining translations
      try {
        const jsonText = extractJson(fullText);
        const translations = parseQuickTranslationResponse(jsonText);
        for (const translation of translations) {
          if (!seenIds.has(translation.id) && !signal?.aborted) {
            seenIds.add(translation.id);
            callbacks.onTranslation(translation);
          }
        }
      } catch {
        // Ignore parse failures; onComplete still reports usage.
      }

      callbacks.onComplete(usage);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (signal?.aborted) {
        return;
      }

      // Fallback to non-streaming
      try {
        if (signal?.aborted) return;

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: QUICK_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 2048,
            stream: false,
          }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
          choices: Array<{ message: { content: string } }>;
          usage: { prompt_tokens: number; completion_tokens: number };
        };

        if (signal?.aborted) return;

        const content = data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in response');
        }

        const jsonText = extractJson(content);
        const translations = parseQuickTranslationResponse(jsonText);

        translations.forEach((translation) => {
          if (!signal?.aborted) {
            callbacks.onTranslation(translation);
          }
        });

        if (!signal?.aborted) {
          callbacks.onComplete({
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          });
        }
      } catch (fallbackError) {
        if (signal?.aborted) return;
        callbacks.onError(fallbackError instanceof Error ? fallbackError : new Error('Translation failed'));
      }
    }
  }

  async getBreakdown(
    text: string,
    apiKey: string,
    context?: BreakdownContext
  ): Promise<BreakdownResult> {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const contextLines: string[] = [];
    if (context?.opAuthor) contextLines.push(`OP author: ${context.opAuthor}`);
    if (context?.opText) contextLines.push(`OP text: ${context.opText}`);
    if (context?.opUrl) contextLines.push(`OP url: ${context.opUrl}`);
    const contextBlock = contextLines.length > 0 ? `\n\nThread context:\n${contextLines.join('\n')}` : '';
    const userPrompt = `Analyze this Chinese text:\n\n${text}${contextBlock}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: BREAKDOWN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in response');
    }

    const jsonText = extractJson(content);

    let parsed: { segments: Array<{ chinese: string; pinyin: string; gloss: string }>; notes: string[] };
    try {
      parsed = JSON.parse(jsonText) as { segments: Array<{ chinese: string; pinyin: string; gloss: string }>; notes: string[] };
      if (!parsed.segments) {
        throw new Error('No segments in response');
      }
    } catch {
      throw new Error(
        `Failed to parse breakdown response. Response was: ${jsonText.slice(0, 500)}`
      );
    }

    return {
      breakdown: parsed,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
  }

  async translateThreadStreaming(
    tweets: Tweet[],
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const FULL_SYSTEM_PROMPT = `You are a Chinese language expert helping English speakers learn Chinese through Twitter content translation.

For each tweet provided, you must return:
1. A natural English translation (not literal/robotic)
2. Segmentation of the Chinese text into meaningful units (as a native speaker would parse it)
3. Pinyin with tone marks (e.g., jīntiān, not jintion1)
4. Word-by-word gloss/meaning
5. Notes about cultural context, internet slang, idioms, or learning tips

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "translations": [
    {
      "id": "tweet_id",
      "naturalTranslation": "Natural English translation",
      "segments": [
        { "chinese": "今天", "pinyin": "jīntiān", "gloss": "today" }
      ],
      "notes": ["Any relevant cultural or linguistic notes"]
    }
  ]
}`;

    if (!apiKey) {
      callbacks.onError(new Error('API key is required'));
      return;
    }

    if (tweets.length === 0) {
      callbacks.onError(new Error('No tweets to translate'));
      return;
    }

    const tweetsForTranslation = tweets.map((t) => ({
      id: t.id,
      text: t.text,
      author: t.author,
    }));

    const userPrompt = `Translate these Chinese tweets:

${JSON.stringify(tweetsForTranslation, null, 2)}

Remember to:
- Provide natural, fluent English translations
- Break down each text into meaningful segments
- Use pinyin with tone marks (diacritics)
- Include helpful notes for language learners`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: FULL_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 4096,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in response');
      }

      const jsonText = extractJson(content);
      const parsed = JSON.parse(jsonText) as { translations?: TranslatedTweet[] };

      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        throw new Error('Invalid response format');
      }

      parsed.translations.forEach((translation) => {
        callbacks.onTranslation(translation);
      });

      callbacks.onComplete({
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      });
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error('Translation failed'));
    }
  }
}
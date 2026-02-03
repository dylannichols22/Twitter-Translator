import type {
  BreakdownContext,
  BreakdownResult,
  QuickStreamCallbacks,
  QuickTranslation,
  StreamCallbacks,
  TranslatedTweet,
  TranslationProvider,
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

// Gemini API types
interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GoogleProvider implements TranslationProvider {
  readonly name = 'google';
  readonly model = 'gemini-2.0-flash';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  private async makeRequest(
    apiKey: string,
    contents: GeminiContent[],
    maxTokens: number,
    signal?: AbortSignal
  ): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${apiKey}`;

    const body: GeminiRequest = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json() as Promise<GeminiResponse>;
  }

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
      const contents: GeminiContent[] = [
        { role: 'user', parts: [{ text: `${QUICK_SYSTEM_PROMPT}\n\n${userPrompt}` }] },
      ];

      const data = await this.makeRequest(apiKey, contents, 2048, signal);

      if (signal?.aborted) return;

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No text in response');
      }

      const jsonText = extractJson(text);
      const translations = parseQuickTranslationResponse(jsonText);
      const seenIds = new Set<string>();

      for (const translation of translations) {
        if (!seenIds.has(translation.id) && !signal?.aborted) {
          seenIds.add(translation.id);
          callbacks.onTranslation(translation);
        }
      }

      callbacks.onComplete({
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (signal?.aborted) {
        return;
      }
      callbacks.onError(error instanceof Error ? error : new Error('Translation failed'));
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

    const contents: GeminiContent[] = [
      { role: 'user', parts: [{ text: `${BREAKDOWN_SYSTEM_PROMPT}\n\n${userPrompt}` }] },
    ];

    const data = await this.makeRequest(apiKey, contents, 2048);

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('No text in response');
    }

    const jsonText = extractJson(responseText);

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
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
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
      const contents: GeminiContent[] = [
        { role: 'user', parts: [{ text: `${FULL_SYSTEM_PROMPT}\n\n${userPrompt}` }] },
      ];

      const data = await this.makeRequest(apiKey, contents, 4096);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('No text in response');
      }

      const jsonText = extractJson(text);
      const parsed = JSON.parse(jsonText) as { translations?: TranslatedTweet[] };

      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        throw new Error('Invalid response format');
      }

      parsed.translations.forEach((translation) => {
        callbacks.onTranslation(translation);
      });

      callbacks.onComplete({
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      });
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error('Translation failed'));
    }
  }
}

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

// Dynamic import Anthropic to avoid issues if not used
let Anthropic: typeof import('@anthropic-ai/sdk').default | null = null;

async function getAnthropic() {
  if (!Anthropic) {
    const module = await import('@anthropic-ai/sdk');
    Anthropic = module.default;
  }
  return Anthropic;
}

function extractJson(text: string): string {
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }
  return jsonText;
}

function normalizeBreakdown(parsed: Partial<{ segments: unknown; notes: unknown }>): { segments: Array<{ chinese: string; pinyin: string; gloss: string }>; notes: string[] } {
  return {
    segments: Array.isArray(parsed.segments) ? parsed.segments : [],
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
  };
}

function extractNotes(jsonText: string): string[] {
  const notesMatch = jsonText.match(/"notes"\s*:\s*\[/);
  if (!notesMatch || notesMatch.index === undefined) return [];

  const start = jsonText.indexOf('[', notesMatch.index);
  if (start === -1) return [];

  let inString = false;
  let stringChar = '';
  let escape = false;
  let depth = 0;

  for (let i = start; i < jsonText.length; i += 1) {
    const char = jsonText[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        const slice = jsonText.slice(start, i + 1);
        try {
          const parsed = JSON.parse(slice);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}

function extractSegments(jsonText: string): Array<{ chinese: string; pinyin: string; gloss: string }> {
  const segments: Array<{ chinese: string; pinyin: string; gloss: string }> = [];
  const segmentsMatch = jsonText.match(/"segments"\s*:\s*\[/);
  if (!segmentsMatch || segmentsMatch.index === undefined) return segments;

  const arrayStart = jsonText.indexOf('[', segmentsMatch.index);
  if (arrayStart === -1) return segments;

  let inString = false;
  let stringChar = '';
  let escape = false;

  for (let i = arrayStart + 1; i < jsonText.length; i += 1) {
    const char = jsonText[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char !== '{') {
      continue;
    }

    let depth = 0;
    let innerInString = false;
    let innerStringChar = '';
    let innerEscape = false;
    let end = -1;

    for (let j = i; j < jsonText.length; j += 1) {
      const innerChar = jsonText[j];

      if (innerInString) {
        if (innerEscape) {
          innerEscape = false;
        } else if (innerChar === '\\') {
          innerEscape = true;
        } else if (innerChar === innerStringChar) {
          innerInString = false;
        }
        continue;
      }

      if (innerChar === '"' || innerChar === "'") {
        innerInString = true;
        innerStringChar = innerChar;
        continue;
      }

      if (innerChar === '{') {
        depth += 1;
      } else if (innerChar === '}') {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end === -1) {
      break;
    }

    const slice = jsonText.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as { chinese: string; pinyin: string; gloss: string };
      if (parsed && parsed.chinese && parsed.pinyin && parsed.gloss) {
        segments.push(parsed);
      }
    } catch {
      // Skip malformed segment
    }

    i = end;
  }

  return segments;
}

function parseBreakdownResponse(jsonText: string): { segments: Array<{ chinese: string; pinyin: string; gloss: string }>; notes: string[] } {
  try {
    const parsed = JSON.parse(jsonText) as Partial<{ segments: unknown; notes: unknown }>;
    return normalizeBreakdown(parsed);
  } catch {
    const segments = extractSegments(jsonText);
    const notes = extractNotes(jsonText);
    if (segments.length > 0) {
      return { segments, notes };
    }
    throw new Error('Failed to parse breakdown response.');
  }
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

export class AnthropicProvider implements TranslationProvider {
  readonly name = 'anthropic';
  readonly model = 'claude-haiku-4-5-20251001';

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

    const AnthropicSDK = await getAnthropic();
    if (!AnthropicSDK) {
      callbacks.onError(new Error('Failed to load Anthropic SDK'));
      return;
    }

    const client = new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true });

    const tweetsForTranslation = tweets.map((t) => ({
      id: t.id,
      text: t.text,
    }));

    const userPrompt = `Translate these Chinese tweets:\n\n${JSON.stringify(tweetsForTranslation, null, 2)}`;

    try {
      const stream = client.messages.stream({
        model: this.model,
        max_tokens: 2048,
        system: QUICK_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      if (signal) {
        signal.addEventListener('abort', () => {
          stream.controller.abort();
        }, { once: true });
      }

      let fullText = '';
      const seenIds = new Set<string>();

      stream.on('text', (text) => {
        if (signal?.aborted) return;

        fullText += text;

        const jsonText = extractJson(fullText);
        const translations = extractQuickTranslations(jsonText);

        for (const translation of translations) {
          if (!seenIds.has(translation.id) && !signal?.aborted) {
            seenIds.add(translation.id);
            callbacks.onTranslation(translation);
          }
        }
      });

      const finalMessage = await stream.finalMessage();

      if (signal?.aborted) return;

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

      callbacks.onComplete({
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (signal?.aborted) {
        return;
      }

      try {
        if (signal?.aborted) return;

        const response = await client.messages.create({
          model: this.model,
          max_tokens: 2048,
          system: QUICK_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        if (signal?.aborted) return;

        const textContent = response.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text response from API');
        }

        const jsonText = extractJson(textContent.text);
        const translations = parseQuickTranslationResponse(jsonText);

        translations.forEach((translation) => {
          if (!signal?.aborted) {
            callbacks.onTranslation(translation);
          }
        });

        if (!signal?.aborted) {
          callbacks.onComplete({
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
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

    const AnthropicSDK = await getAnthropic();
    if (!AnthropicSDK) {
      throw new Error('Failed to load Anthropic SDK');
    }

    const client = new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true });

    const contextLines: string[] = [];
    if (context?.opAuthor) contextLines.push(`OP author: ${context.opAuthor}`);
    if (context?.opText) contextLines.push(`OP text: ${context.opText}`);
    if (context?.opUrl) contextLines.push(`OP url: ${context.opUrl}`);
    const contextBlock = contextLines.length > 0 ? `\n\nThread context:\n${contextLines.join('\n')}` : '';
    const userPrompt = `Analyze this Chinese text:\n\n${text}${contextBlock}`;

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: BREAKDOWN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from API');
    }

    const jsonText = extractJson(textContent.text);

    let parsed: { segments: Array<{ chinese: string; pinyin: string; gloss: string }>; notes: string[] };
    try {
      parsed = parseBreakdownResponse(jsonText);
    } catch {
      throw new Error(
        `Failed to parse breakdown response. Response was: ${jsonText.slice(0, 500)}`
      );
    }

    return {
      breakdown: parsed,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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

    const AnthropicSDK = await getAnthropic();
    if (!AnthropicSDK) {
      callbacks.onError(new Error('Failed to load Anthropic SDK'));
      return;
    }

    const client = new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true });

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
      const stream = client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: FULL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      let fullText = '';

      stream.on('text', (text) => {
        fullText += text;
      });

      const finalMessage = await stream.finalMessage();

      const jsonText = extractJson(fullText);
      const parsed = JSON.parse(jsonText) as { translations?: TranslatedTweet[] };

      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        throw new Error('Invalid response format');
      }

      parsed.translations.forEach((translation) => {
        callbacks.onTranslation(translation);
      });

      callbacks.onComplete({
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      });
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error('Translation failed'));
    }
  }
}

import Anthropic from '@anthropic-ai/sdk';
import type { Tweet } from '../scraper';

export interface Segment {
  chinese: string;
  pinyin: string;
  gloss: string;
}

export interface TranslatedTweet {
  id: string;
  naturalTranslation: string;
  segments: Segment[];
  notes: string[];
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
}

export interface TranslationResult {
  translations: TranslatedTweet[];
  usage: UsageStats;
}

interface ApiResponse {
  translations: TranslatedTweet[];
}

const SYSTEM_PROMPT = `You are a Chinese language expert helping English speakers learn Chinese through Twitter content translation.

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

function extractJson(text: string): string {
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }
  return jsonText;
}

// Try to extract complete translation objects from partial JSON
function extractCompleteTranslations(text: string): TranslatedTweet[] {
  const translations: TranslatedTweet[] = [];

  // Look for complete translation objects in the array
  // Match objects that have all required fields closed
  const regex =
    /\{\s*"id"\s*:\s*"[^"]*"\s*,\s*"naturalTranslation"\s*:\s*"[^"]*"\s*,\s*"segments"\s*:\s*\[[\s\S]*?\]\s*,\s*"notes"\s*:\s*\[[\s\S]*?\]\s*\}/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.id && obj.naturalTranslation && obj.segments && obj.notes) {
        translations.push(obj);
      }
    } catch {
      // Partial object, skip
    }
  }

  return translations;
}

export interface StreamCallbacks {
  onTranslation: (translation: TranslatedTweet) => void;
  onComplete: (usage: UsageStats) => void;
  onError: (error: Error) => void;
}

export async function translateThreadStreaming(
  tweets: Tweet[],
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> {
  if (!apiKey) {
    callbacks.onError(new Error('API key is required'));
    return;
  }

  if (tweets.length === 0) {
    callbacks.onError(new Error('No tweets to translate'));
    return;
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let fullText = '';
    const seenIds = new Set<string>();

    stream.on('text', (text) => {
      fullText += text;

      // Try to extract complete translations from accumulated text
      const jsonText = extractJson(fullText);
      const translations = extractCompleteTranslations(jsonText);

      for (const translation of translations) {
        if (!seenIds.has(translation.id)) {
          seenIds.add(translation.id);
          callbacks.onTranslation(translation);
        }
      }
    });

    const finalMessage = await stream.finalMessage();

    callbacks.onComplete({
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    });
  } catch (error) {
    callbacks.onError(error instanceof Error ? error : new Error('Translation failed'));
  }
}

// Keep the non-streaming version for compatibility
export async function translateThread(tweets: Tweet[], apiKey: string): Promise<TranslationResult> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (tweets.length === 0) {
    throw new Error('No tweets to translate');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from API');
  }

  const jsonText = extractJson(textContent.text);

  let parsed: ApiResponse;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse API response as JSON. Response was: ${jsonText.slice(0, 500)}`);
  }

  return {
    translations: parsed.translations,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

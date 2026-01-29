import Anthropic from '@anthropic-ai/sdk';
import type { Tweet } from '../scraper';

export interface Segment {
  chinese: string;
  pinyin: string;
  gloss: string;
}

export interface Breakdown {
  segments: Segment[];
  notes: string[];
}

// Quick translation - just the natural translation
export interface QuickTranslation {
  id: string;
  naturalTranslation: string;
}

// Full translation with breakdown
export interface TranslatedTweet extends QuickTranslation {
  segments: Segment[];
  notes: string[];
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
}

export interface QuickTranslationResult {
  translations: QuickTranslation[];
  usage: UsageStats;
}

export interface BreakdownResult {
  breakdown: Breakdown;
  usage: UsageStats;
}

// Legacy full result for caching
export interface TranslationResult {
  translations: TranslatedTweet[];
  usage: UsageStats;
}

function extractJson(text: string): string {
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }
  return jsonText;
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
4. Notes about cultural context, internet slang, idioms, or learning tips

IMPORTANT: Return ONLY valid JSON matching this exact structure:
{
  "segments": [
    { "chinese": "今天", "pinyin": "jīntiān", "gloss": "today" }
  ],
  "notes": ["Any relevant cultural or linguistic notes"]
}`;

// Try to extract complete quick translation objects from partial JSON
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

export interface QuickStreamCallbacks {
  onTranslation: (translation: QuickTranslation) => void;
  onComplete: (usage: UsageStats) => void;
  onError: (error: Error) => void;
}

// Quick streaming translation - just natural translations
export async function translateQuickStreaming(
  tweets: Tweet[],
  apiKey: string,
  callbacks: QuickStreamCallbacks
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
  }));

  const userPrompt = `Translate these Chinese tweets:\n\n${JSON.stringify(tweetsForTranslation, null, 2)}`;

  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: QUICK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let fullText = '';
    const seenIds = new Set<string>();

    stream.on('text', (text) => {
      fullText += text;

      const jsonText = extractJson(fullText);
      const translations = extractQuickTranslations(jsonText);

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

// Get detailed breakdown for a single tweet (on demand)
export async function getBreakdown(text: string, apiKey: string): Promise<BreakdownResult> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const userPrompt = `Analyze this Chinese text:\n\n${text}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: BREAKDOWN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from API');
  }

  const jsonText = extractJson(textContent.text);

  let parsed: Breakdown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Failed to parse breakdown response. Response was: ${jsonText.slice(0, 500)}`);
  }

  return {
    breakdown: parsed,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// Legacy exports for compatibility
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
  // For backwards compatibility, use the old full translation approach
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
      system: FULL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let fullText = '';
    const seenIds = new Set<string>();

    const extractCompleteTranslations = (text: string): TranslatedTweet[] => {
      const translations: TranslatedTweet[] = [];
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
    };

    stream.on('text', (text) => {
      fullText += text;

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

export async function translateThread(tweets: Tweet[], apiKey: string): Promise<TranslationResult> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (tweets.length === 0) {
    throw new Error('No tweets to translate');
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

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
    system: FULL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from API');
  }

  const jsonText = extractJson(textContent.text);

  interface ApiResponse {
    translations: TranslatedTweet[];
  }

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

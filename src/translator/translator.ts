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

export async function translateThread(
  tweets: Tweet[],
  apiKey: string
): Promise<TranslationResult> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (tweets.length === 0) {
    throw new Error('No tweets to translate');
  }

  const client = new Anthropic({ apiKey });

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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from API');
  }

  const parsed: ApiResponse = JSON.parse(textContent.text);

  return {
    translations: parsed.translations,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

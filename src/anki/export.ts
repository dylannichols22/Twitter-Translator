import type { SavedItem } from '../saved';

export interface AnkiExportOptions {
  deckName?: string;
  now?: Date;
}

export interface AnkiExportResult {
  content: string;
  filename: string;
  count: number;
}

const DEFAULT_DECK_NAME = 'Twitter Translator';

const sanitizeField = (value: string): string => {
  return value.replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim();
};

const appendSection = (lines: string[], label: string, values: string[]): void => {
  const cleaned = values.map(sanitizeField).filter((value) => value.length > 0);
  if (cleaned.length === 0) {
    return;
  }
  lines.push('');
  lines.push(label);
  lines.push(...cleaned);
};

const buildBack = (item: SavedItem): string => {
  const lines: string[] = [];
  if (item.pinyin) lines.push(item.pinyin);
  if (item.gloss) lines.push(item.gloss);

  if ('naturalTranslation' in item && item.naturalTranslation) {
    appendSection(lines, 'Translation', [item.naturalTranslation]);
  }

  if ('notes' in item && Array.isArray(item.notes) && item.notes.length > 0) {
    appendSection(lines, 'Notes', item.notes);
  }

  if ('metadata' in item && item.metadata?.tweetUrl) {
    appendSection(lines, 'Source', [item.metadata.tweetUrl]);
  }

  const normalized = lines.map(sanitizeField);
  return normalized.join('<br>');
};

const safeDeckName = (deckName: string): string => {
  const cleaned = deckName.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-');
  return cleaned.length > 0 ? cleaned : 'Twitter-Translator';
};

export const buildAnkiExport = (items: SavedItem[], options: AnkiExportOptions = {}): AnkiExportResult => {
  const deckName = options.deckName?.trim() || DEFAULT_DECK_NAME;
  const lines = items.map((item) => {
    const front = sanitizeField(item.chinese);
    const back = buildBack(item);
    return `${front}\t${back}`;
  });

  const content = lines.join('\n');
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const filename = `twitter-translator-${safeDeckName(deckName)}-${date}.txt`;

  return { content, filename, count: items.length };
};

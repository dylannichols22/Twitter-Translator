import { describe, it, expect } from 'vitest';
import { buildAnkiExport } from './export';
import type { SavedItem } from '../saved';

describe('buildAnkiExport', () => {
  it('builds a tab-separated export with a stable filename', () => {
    const items: SavedItem[] = [
      {
        id: '1',
        type: 'segment',
        savedAt: '2025-01-01T00:00:00.000Z',
        chinese: 'nihao',
        pinyin: 'ni hao',
        gloss: 'hello',
      },
      {
        id: '2',
        type: 'sentence',
        savedAt: '2025-01-02T00:00:00.000Z',
        chinese: 'zaoshanghao',
        pinyin: 'zao shang hao',
        gloss: 'good morning',
        naturalTranslation: 'Good morning',
        segments: [],
      },
    ];

    const result = buildAnkiExport(items, {
      deckName: 'My Deck',
      now: new Date('2025-01-05T10:00:00.000Z'),
    });

    expect(result.filename).toBe('twitter-translator-My-Deck-2025-01-05.txt');
    expect(result.count).toBe(2);
    expect(result.content).toBe(
      [
        'nihao\tni hao<br>hello',
        'zaoshanghao\tzao shang hao<br>good morning<br><br>Translation<br>Good morning',
      ].join('\n')
    );
  });

  it('sanitizes tabs and newlines in fields', () => {
    const items: SavedItem[] = [
      {
        id: '1',
        type: 'segment',
        savedAt: '2025-01-01T00:00:00.000Z',
        chinese: 'ni\thao\n',
        pinyin: 'ni\nhao',
        gloss: 'he\tllo',
      },
    ];

    const result = buildAnkiExport(items, { now: new Date('2025-01-01T00:00:00.000Z') });
    expect(result.content).toBe('ni hao\tni hao<br>he llo');
  });

  it('adds notes and source sections for posts', () => {
    const items: SavedItem[] = [
      {
        id: '3',
        type: 'post',
        savedAt: '2025-01-03T00:00:00.000Z',
        chinese: 'test',
        pinyin: 'test',
        gloss: 'test',
        segments: [],
        notes: ['first note', 'second note'],
        naturalTranslation: 'translated',
        metadata: { tweetUrl: 'https://twitter.com/user/status/123' },
      },
    ];

    const result = buildAnkiExport(items, { now: new Date('2025-01-03T00:00:00.000Z') });
    expect(result.content).toBe(
      'test\ttest<br>test<br><br>Translation<br>translated<br><br>Notes<br>first note<br>second note<br><br>Source<br>https://twitter.com/user/status/123'
    );
  });
});

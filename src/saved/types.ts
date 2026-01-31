export type SavedItemType = 'segment' | 'sentence' | 'post';

export interface SavedItemBase {
  id: string;
  type: SavedItemType;
  savedAt: string;
  chinese: string;
  pinyin: string;
  gloss: string;
}

export interface SavedSegment extends SavedItemBase {
  type: 'segment';
}

export interface SavedSentence extends SavedItemBase {
  type: 'sentence';
  segments: Array<{ chinese: string; pinyin: string; gloss: string }>;
  naturalTranslation?: string;
}

export interface SavedPost extends SavedItemBase {
  type: 'post';
  segments: Array<{ chinese: string; pinyin: string; gloss: string }>;
  notes: string[];
  naturalTranslation: string;
  metadata: {
    tweetUrl?: string;
    tweetId?: string;
    author?: string;
    timestamp?: string;
  };
}

export type SavedItem = SavedSegment | SavedSentence | SavedPost;

export interface SavedItemsData {
  version: number;
  items: SavedItem[];
  lastModified: string;
}

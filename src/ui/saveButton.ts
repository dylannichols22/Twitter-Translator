import { MESSAGE_TYPES } from '../messages';
import type { SavedSegment, SavedSentence, SavedPost, SavedItemType } from '../saved';

export interface SegmentData {
  chinese: string;
  pinyin: string;
  gloss: string;
}

export interface SentenceData {
  segments: SegmentData[];
  naturalTranslation?: string;
}

export interface PostData {
  segments: SegmentData[];
  notes: string[];
  naturalTranslation: string;
  metadata: {
    tweetUrl?: string;
    tweetId?: string;
    author?: string;
    timestamp?: string;
  };
}

export type SaveCallback = (success: boolean, message: string) => void;

const SVG_NS = 'http://www.w3.org/2000/svg';

function createBookmarkIcon(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'currentColor');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z');
  svg.appendChild(path);

  return svg;
}

function setButtonContent(button: HTMLElement, label: string | null, size: number): void {
  while (button.firstChild) {
    button.removeChild(button.firstChild);
  }
  button.appendChild(createBookmarkIcon(size));
  if (label) {
    button.appendChild(document.createTextNode(` ${label}`));
  }
}

async function checkIsSaved(chinese: string, type: SavedItemType): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.IS_ITEM_SAVED,
      data: { chinese, type },
    });
    return response?.isSaved ?? false;
  } catch {
    return false;
  }
}

async function saveItem(
  data: Omit<SavedSegment, 'id' | 'savedAt'> | Omit<SavedSentence, 'id' | 'savedAt'> | Omit<SavedPost, 'id' | 'savedAt'>
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_ITEM,
      data,
    });
    if (response?.success) {
      return { success: true, message: 'Saved!' };
    }
    return { success: false, message: 'Failed to save' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Failed to save' };
  }
}

export function createSegmentSaveIcon(
  segment: SegmentData,
  onSave?: SaveCallback
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'save-icon save-segment-icon';
  btn.type = 'button';
  btn.title = 'Save word';
  setButtonContent(btn, null, 16);

  let isSaved = false;

  checkIsSaved(segment.chinese, 'segment').then((saved) => {
    isSaved = saved;
    if (saved) {
      btn.classList.add('saved');
      btn.title = 'Already saved';
    }
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isSaved) {
      onSave?.(false, 'Already saved');
      return;
    }

    const itemData: Omit<SavedSegment, 'id' | 'savedAt'> = {
      type: 'segment',
      chinese: segment.chinese,
      pinyin: segment.pinyin,
      gloss: segment.gloss,
    };

    const result = await saveItem(itemData);
    if (result.success) {
      isSaved = true;
      btn.classList.add('saved');
      btn.title = 'Saved!';
    }
    onSave?.(result.success, result.message);
  });

  return btn;
}

export function createSentenceSaveButton(
  sentence: SentenceData,
  onSave?: SaveCallback
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'save-btn save-sentence-btn';
  btn.type = 'button';
  setButtonContent(btn, 'Save', 14);

  const fullChinese = sentence.segments.map((s) => s.chinese).join('');
  let isSaved = false;

  checkIsSaved(fullChinese, 'sentence').then((saved) => {
    isSaved = saved;
    if (saved) {
      btn.classList.add('saved');
      setButtonContent(btn, 'Saved', 14);
    }
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isSaved) {
      onSave?.(false, 'Already saved');
      return;
    }

    const fullPinyin = sentence.segments.map((s) => s.pinyin).join(' ');
    const fullGloss = sentence.segments.map((s) => s.gloss).join(' ');

    const itemData: Omit<SavedSentence, 'id' | 'savedAt'> = {
      type: 'sentence',
      chinese: fullChinese,
      pinyin: fullPinyin,
      gloss: fullGloss,
      segments: sentence.segments,
      naturalTranslation: sentence.naturalTranslation,
    };

    const result = await saveItem(itemData);
    if (result.success) {
      isSaved = true;
      btn.classList.add('saved');
      setButtonContent(btn, 'Saved', 14);
    }
    onSave?.(result.success, result.message);
  });

  return btn;
}

export function createPostSaveButton(
  post: PostData,
  onSave?: SaveCallback
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'tweet-action-btn save-btn save-post-btn';
  btn.type = 'button';
  setButtonContent(btn, 'Save Post', 14);

  const fullChinese = post.segments.map((s) => s.chinese).join('');
  let isSaved = false;

  checkIsSaved(fullChinese, 'post').then((saved) => {
    isSaved = saved;
    if (saved) {
      btn.classList.add('saved');
      setButtonContent(btn, 'Saved', 14);
    }
  });

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (isSaved) {
      onSave?.(false, 'Already saved');
      return;
    }

    const fullPinyin = post.segments.map((s) => s.pinyin).join(' ');
    const fullGloss = post.segments.map((s) => s.gloss).join(' ');

    const itemData: Omit<SavedPost, 'id' | 'savedAt'> = {
      type: 'post',
      chinese: fullChinese,
      pinyin: fullPinyin,
      gloss: fullGloss,
      segments: post.segments,
      notes: post.notes,
      naturalTranslation: post.naturalTranslation,
      metadata: post.metadata,
    };

    const result = await saveItem(itemData);
    if (result.success) {
      isSaved = true;
      btn.classList.add('saved');
      setButtonContent(btn, 'Saved', 14);
    }
    onSave?.(result.success, result.message);
  });

  return btn;
}

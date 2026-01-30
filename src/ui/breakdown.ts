import type { Segment, Breakdown } from '../translator';

const SENTENCE_END = /[。！？!?…]+$/;

export function renderSegmentTable(segments: Segment[]): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'segment-table';

  // Row 1: Chinese characters
  const chineseRow = table.insertRow();
  chineseRow.className = 'chinese-row';
  segments.forEach((seg) => {
    const cell = chineseRow.insertCell();
    cell.textContent = seg.chinese;
  });

  // Row 2: Pinyin
  const pinyinRow = table.insertRow();
  pinyinRow.className = 'pinyin-row';
  segments.forEach((seg) => {
    const cell = pinyinRow.insertCell();
    cell.textContent = seg.pinyin;
  });

  // Row 3: Gloss
  const glossRow = table.insertRow();
  glossRow.className = 'gloss-row';
  segments.forEach((seg) => {
    const cell = glossRow.insertCell();
    cell.textContent = seg.gloss;
  });

  return table;
}

export function renderNotes(notes: string[]): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'notes-section';

  const heading = document.createElement('h4');
  heading.textContent = 'Notes';
  container.appendChild(heading);

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No notes available';
    empty.className = 'empty-notes';
    container.appendChild(empty);
    return container;
  }

  const list = document.createElement('ul');
  notes.forEach((note) => {
    const item = document.createElement('li');
    item.textContent = note;
    list.appendChild(item);
  });
  container.appendChild(list);

  return container;
}

export function groupSegmentsForTables(segments: Segment[], maxSegments = 8): Segment[][] {
  const groups: Segment[][] = [];
  let current: Segment[] = [];

  const flush = () => {
    if (current.length > 0) {
      groups.push(current);
      current = [];
    }
  };

  for (const segment of segments) {
    current.push(segment);

    const endsSentence = SENTENCE_END.test(segment.chinese.trim()) || segment.chinese.includes('\n');
    if (endsSentence || current.length >= maxSegments) {
      flush();
    }
  }

  flush();
  return groups;
}

export function renderBreakdownContent(breakdown: Breakdown): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const groups = groupSegmentsForTables(breakdown.segments, 8);

  for (const group of groups) {
    const wrapper = document.createElement('div');
    wrapper.className = 'segment-table-wrapper';
    wrapper.appendChild(renderSegmentTable(group));
    fragment.appendChild(wrapper);
  }

  fragment.appendChild(renderNotes(breakdown.notes));
  return fragment;
}

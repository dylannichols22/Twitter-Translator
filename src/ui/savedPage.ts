import { MESSAGE_TYPES } from '../messages';
import { clearElement } from './dom';
import type { SavedItem, SavedItemType } from '../saved';

class SavedPageController {
  private cardsContainer: HTMLElement | null;
  private emptyState: HTMLElement | null;
  private statsEl: HTMLElement | null;
  private exportBtn: HTMLElement | null;
  private exportModal: HTMLElement | null;
  private exportData: HTMLTextAreaElement | null;
  private exportDeckName: HTMLInputElement | null;
  private exportSummary: HTMLElement | null;
  private downloadExportBtn: HTMLButtonElement | null;
  private copyExportBtn: HTMLElement | null;
  private closeModalBtn: HTMLElement | null;
  private filterBtns: NodeListOf<HTMLButtonElement>;

  private items: SavedItem[] = [];
  private currentFilter: SavedItemType | 'all' = 'all';
  private exportFilename = '';

  constructor() {
    this.cardsContainer = document.getElementById('cards-container');
    this.emptyState = document.getElementById('empty-state');
    this.statsEl = document.getElementById('stats');
    this.exportBtn = document.getElementById('export-btn');
    this.exportModal = document.getElementById('export-modal');
    this.exportData = document.getElementById('export-data') as HTMLTextAreaElement;
    this.exportDeckName = document.getElementById('export-deck-name') as HTMLInputElement;
    this.exportSummary = document.getElementById('export-summary');
    this.downloadExportBtn = document.getElementById('download-anki') as HTMLButtonElement;
    this.copyExportBtn = document.getElementById('copy-export');
    this.closeModalBtn = document.getElementById('close-modal');
    this.filterBtns = document.querySelectorAll('.filter-btn');

    this.bindEvents();
    this.loadItems();
  }

  private bindEvents(): void {
    this.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter as SavedItemType | 'all';
        this.setFilter(filter);
      });
    });

    this.exportBtn?.addEventListener('click', () => this.showExportModal());
    this.closeModalBtn?.addEventListener('click', () => this.hideExportModal());
    this.copyExportBtn?.addEventListener('click', () => this.copyExportData());
    this.downloadExportBtn?.addEventListener('click', () => this.downloadExport());
    this.exportDeckName?.addEventListener('input', () => {
      this.saveDeckName();
      void this.refreshExport();
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) {
        this.hideExportModal();
      }
    });
  }

  private async loadItems(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SAVED_ITEMS,
      });

      if (response?.success && Array.isArray(response.items)) {
        this.items = response.items;
        this.render();
      }
    } catch (error) {
      console.error('Failed to load saved items:', error);
    }
  }

  private setFilter(filter: SavedItemType | 'all'): void {
    this.currentFilter = filter;

    this.filterBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this.render();
    if (this.exportModal?.classList.contains('visible')) {
      void this.refreshExport();
    }
  }

  private getFilteredItems(): SavedItem[] {
    if (this.currentFilter === 'all') {
      return this.items;
    }
    return this.items.filter((item) => item.type === this.currentFilter);
  }

  private render(): void {
    const filtered = this.getFilteredItems();

    if (this.statsEl) {
      const total = this.items.length;
      const segments = this.items.filter((i) => i.type === 'segment').length;
      const sentences = this.items.filter((i) => i.type === 'sentence').length;
      const posts = this.items.filter((i) => i.type === 'post').length;
      this.statsEl.textContent = `${total} items (${segments} words, ${sentences} sentences, ${posts} posts)`;
    }

    if (filtered.length === 0) {
      if (this.cardsContainer) clearElement(this.cardsContainer);
      this.emptyState?.classList.remove('hidden');
      return;
    }

    this.emptyState?.classList.add('hidden');

    if (this.cardsContainer) {
      clearElement(this.cardsContainer);
      filtered.forEach((item) => {
        const card = this.createFlashcard(item);
        this.cardsContainer!.appendChild(card);
      });
    }
  }

  private createFlashcard(item: SavedItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'flashcard';
    card.dataset.id = item.id;

    const inner = document.createElement('div');
    inner.className = 'flashcard-inner';

    // Front side - Chinese
    const front = document.createElement('div');
    front.className = 'flashcard-front';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'flashcard-type';
    typeLabel.textContent = item.type === 'segment' ? 'Word' : item.type === 'sentence' ? 'Sentence' : 'Post';
    front.appendChild(typeLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'flashcard-delete';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z');
    svg.appendChild(path);
    deleteBtn.appendChild(svg);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteItem(item.id);
    });
    front.appendChild(deleteBtn);

    const chinese = document.createElement('div');
    chinese.className = 'flashcard-chinese';
    chinese.textContent = item.chinese.length > 20 ? item.chinese.slice(0, 20) + '...' : item.chinese;
    front.appendChild(chinese);

    const hint = document.createElement('div');
    hint.className = 'flashcard-hint';
    hint.textContent = 'Click to reveal';
    front.appendChild(hint);

    // Back side - Pinyin, Gloss, Translation
    const back = document.createElement('div');
    back.className = 'flashcard-back';

    const backType = typeLabel.cloneNode(true) as HTMLElement;
    back.appendChild(backType);

    const backDelete = deleteBtn.cloneNode(true) as HTMLButtonElement;
    backDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteItem(item.id);
    });
    back.appendChild(backDelete);

    const pinyin = document.createElement('div');
    pinyin.className = 'flashcard-pinyin';
    pinyin.textContent = item.pinyin;
    back.appendChild(pinyin);

    const gloss = document.createElement('div');
    gloss.className = 'flashcard-gloss';
    gloss.textContent = item.gloss;
    back.appendChild(gloss);

    if ('naturalTranslation' in item && item.naturalTranslation) {
      const translation = document.createElement('div');
      translation.className = 'flashcard-translation';
      translation.textContent = item.naturalTranslation;
      back.appendChild(translation);
    }

    const date = document.createElement('div');
    date.className = 'flashcard-date';
    date.textContent = new Date(item.savedAt).toLocaleDateString();
    back.appendChild(date);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
    });

    return card;
  }

  private async deleteItem(id: string): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.DELETE_SAVED_ITEM,
        data: { id },
      });

      if (response?.success) {
        this.items = this.items.filter((item) => item.id !== id);
        this.render();
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  }

  private async showExportModal(): Promise<void> {
    this.exportModal?.classList.add('visible');
    if (this.exportDeckName && !this.exportDeckName.value) {
      const stored = localStorage.getItem('ankiDeckName');
      this.exportDeckName.value = stored || 'Twitter Translator';
    }
    await this.refreshExport();
  }

  private async refreshExport(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.EXPORT_SAVED_ITEMS,
        data: {
          deckName: this.exportDeckName?.value || undefined,
          type: this.currentFilter === 'all' ? undefined : this.currentFilter,
        },
      });

      if (response?.success && this.exportData) {
        this.exportData.value = response.data;
        if (typeof response.filename === 'string') {
          this.exportFilename = response.filename;
        }
        if (typeof response.count === 'number' && this.exportSummary) {
          const filterLabel =
            this.currentFilter === 'all' ? 'All' : this.currentFilter === 'segment' ? 'Words' : this.currentFilter === 'sentence' ? 'Sentences' : 'Posts';
          this.exportSummary.textContent = `${filterLabel}: ${response.count} item${response.count === 1 ? '' : 's'}`;
        }
      }
    } catch (error) {
      console.error('Failed to export items:', error);
    }
  }

  private hideExportModal(): void {
    this.exportModal?.classList.remove('visible');
  }

  private async copyExportData(): Promise<void> {
    if (this.exportData) {
      try {
        await navigator.clipboard.writeText(this.exportData.value);
        if (this.copyExportBtn) {
          const original = this.copyExportBtn.textContent;
          this.copyExportBtn.textContent = 'Copied!';
          setTimeout(() => {
            if (this.copyExportBtn) this.copyExportBtn.textContent = original;
          }, 2000);
        }
      } catch {
        this.exportData.select();
        document.execCommand('copy');
      }
    }
  }

  private downloadExport(): void {
    if (!this.exportData || !this.exportData.value) {
      return;
    }

    const blob = new Blob([this.exportData.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.exportFilename || 'twitter-translator-anki-export.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private saveDeckName(): void {
    if (this.exportDeckName) {
      const value = this.exportDeckName.value.trim();
      if (value.length > 0) {
        localStorage.setItem('ankiDeckName', value);
      }
    }
  }
}

// Initialize when DOM is ready
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
  new SavedPageController();
} else if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => new SavedPageController());
}

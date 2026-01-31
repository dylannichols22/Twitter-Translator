import type { SavedItem, SavedItemsData, SavedItemType } from './types';

const STORAGE_KEY = 'savedItems';
const MAX_ITEMS = 1000;
const CURRENT_VERSION = 1;

export class SavedItemsManager {
  private generateId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private async getData(): Promise<SavedItemsData> {
    const result = await browser.storage.local.get([STORAGE_KEY]);
    const stored = result[STORAGE_KEY] as SavedItemsData | undefined;

    if (!stored) {
      return {
        version: CURRENT_VERSION,
        items: [],
        lastModified: new Date().toISOString(),
      };
    }

    return stored;
  }

  private async saveData(data: SavedItemsData): Promise<void> {
    data.lastModified = new Date().toISOString();
    await browser.storage.local.set({ [STORAGE_KEY]: data });
  }

  async getAll(): Promise<SavedItem[]> {
    const data = await this.getData();
    return data.items;
  }

  async save(item: Omit<SavedItem, 'id' | 'savedAt'>): Promise<SavedItem> {
    const data = await this.getData();

    if (data.items.length >= MAX_ITEMS) {
      throw new Error(`Maximum saved items limit (${MAX_ITEMS}) reached`);
    }

    const newItem: SavedItem = {
      ...item,
      id: this.generateId(),
      savedAt: new Date().toISOString(),
    } as SavedItem;

    data.items.unshift(newItem);
    await this.saveData(data);

    return newItem;
  }

  async delete(id: string): Promise<boolean> {
    const data = await this.getData();
    const index = data.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    data.items.splice(index, 1);
    await this.saveData(data);

    return true;
  }

  async search(query: string): Promise<SavedItem[]> {
    const items = await this.getAll();
    const lowerQuery = query.toLowerCase();

    return items.filter((item) => {
      return (
        item.chinese.toLowerCase().includes(lowerQuery) ||
        item.pinyin.toLowerCase().includes(lowerQuery) ||
        item.gloss.toLowerCase().includes(lowerQuery)
      );
    });
  }

  async isDuplicate(chinese: string, type: SavedItemType): Promise<boolean> {
    const items = await this.getAll();
    return items.some((item) => item.type === type && item.chinese === chinese);
  }

  async getByType(type: SavedItemType): Promise<SavedItem[]> {
    const items = await this.getAll();
    return items.filter((item) => item.type === type);
  }

  async serialize(): Promise<string> {
    const data = await this.getData();
    return JSON.stringify(data, null, 2);
  }

  async getCount(): Promise<number> {
    const items = await this.getAll();
    return items.length;
  }

  async clear(): Promise<void> {
    await browser.storage.local.remove([STORAGE_KEY]);
  }
}

export const savedItemsManager = new SavedItemsManager();

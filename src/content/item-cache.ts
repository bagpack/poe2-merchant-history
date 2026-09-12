import type { CapturedItem } from "../injected/types.js";

const MAX_ITEM_CACHE_SIZE = 1000;
const ITEM_CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  item: CapturedItem;
  cachedAt: number;
}

export class ItemCache {
  private readonly entriesByItemId = new Map<string, CacheEntry>();

  constructor(
    private readonly maxSize = MAX_ITEM_CACHE_SIZE,
    private readonly ttlMs = ITEM_CACHE_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  get size(): number {
    this.removeExpired(this.now());
    return this.entriesByItemId.size;
  }

  putBatch(items: CapturedItem[]): void {
    const cachedAt = this.now();
    this.removeExpired(cachedAt);

    for (const item of items) {
      this.put(item, cachedAt);
    }
  }

  getByItemId(itemId: string): CapturedItem | null {
    const entry = this.entriesByItemId.get(itemId);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry, this.now())) {
      this.remove(itemId);
      return null;
    }

    return entry.item;
  }

  getByResultId(resultId: string): CapturedItem | null {
    this.removeExpired(this.now());
    for (const { item } of this.entriesByItemId.values()) {
      if (item.resultId === resultId) {
        return item;
      }
    }
    return null;
  }

  private put(item: CapturedItem, cachedAt: number): void {
    this.remove(item.itemId);
    this.entriesByItemId.set(item.itemId, { item, cachedAt });

    while (this.entriesByItemId.size > this.maxSize) {
      const oldestItemId = this.entriesByItemId.keys().next().value as string | undefined;
      if (!oldestItemId) {
        return;
      }
      this.remove(oldestItemId);
    }
  }

  private removeExpired(now: number): void {
    for (const [itemId, entry] of this.entriesByItemId) {
      if (this.isExpired(entry, now)) {
        this.remove(itemId);
      }
    }
  }

  private isExpired(entry: CacheEntry, now: number): boolean {
    return now - entry.cachedAt >= this.ttlMs;
  }

  private remove(itemId: string): void {
    this.entriesByItemId.delete(itemId);
  }
}

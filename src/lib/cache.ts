interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MemoryCache<T> {
  private cache: CacheEntry<T> | null = null;
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(): T | null {
    if (!this.cache) return null;
    if (Date.now() - this.cache.timestamp > this.ttlMs) return null;
    return this.cache.data;
  }

  set(data: T): void {
    this.cache = { data, timestamp: Date.now() };
  }
}

export const fundingRateCache = new MemoryCache<unknown>(60_000);
export const economicCalendarCache = new MemoryCache<unknown>(300_000);

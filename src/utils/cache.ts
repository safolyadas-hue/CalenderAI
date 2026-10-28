/**
 * Generic Least Recently Used (LRU) Cache with TTL expiration.
 * Used for caching AI responses and expensive calculations to
 * reduce redundant API calls and computation.
 *
 * @template K - Key type
 * @template V - Value type
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; expiresAt: number }>;
  private readonly maxCapacity: number;
  private readonly ttlMs: number;

  /**
   * @param maxCapacity - Maximum number of entries before eviction
   * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(
    maxCapacity: number = 100,
    ttlMs: number = 5 * 60 * 1000
  ) {
    this.maxCapacity = maxCapacity;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  /**
   * Retrieves a value from the cache if it exists and hasn't expired.
   * Accessing an entry moves it to the "most recently used" position.
   *
   * @param key - Cache key to look up
   * @returns The cached value, or undefined if not found/expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Stores a value in the cache. If the cache is at capacity,
   * the least recently used entry is evicted.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param customTtlMs - Optional custom TTL for this entry
   */
  set(key: K, value: V, customTtlMs?: number): void {
    // Delete existing entry to refresh position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest (least recently used) if at capacity
    if (this.cache.size >= this.maxCapacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (customTtlMs ?? this.ttlMs),
    });
  }

  /**
   * Checks if a key exists in the cache and hasn't expired.
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Removes a specific entry from the cache.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Removes all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the number of entries currently in the cache.
   * Note: may include expired entries that haven't been accessed yet.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Purges all expired entries from the cache.
   * Call periodically to reclaim memory.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

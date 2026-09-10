// Best-effort, bounded isolate-local caches. No persistence, secrets or promises.
// Separate TTLs prevent an old POI result from extending the age of traffic data.
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(private ttlMs: number, private capacity: number, private now = Date.now) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expiresAt <= this.now()) { this.entries.delete(key); return; }
    this.entries.delete(key); this.entries.set(key, entry);
    return structuredClone(entry.value);
  }
  set(key: string, value: T) {
    this.entries.delete(key);
    while (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value: structuredClone(value), expiresAt: this.now() + this.ttlMs });
  }
}

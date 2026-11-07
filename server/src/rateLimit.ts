/** Đếm theo cửa sổ cố định, theo khoá bất kỳ (IP, người chơi...). */
export class RateLimiter {
  private hits = new Map<string, { count: number; until: number }>();
  constructor(private max: number, private windowMs: number) {}

  /** true = cho qua */
  take(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || h.until <= now) {
      this.hits.set(key, { count: 1, until: now + this.windowMs });
      if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.until <= now) this.hits.delete(k);
      return true;
    }
    h.count++;
    return h.count <= this.max;
  }
}

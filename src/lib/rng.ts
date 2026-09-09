/**
 * Deterministic pseudo random number generator (mulberry32).
 * A fixed seed guarantees that every reload of the demo produces the exact same
 * dataset, which is required for a reproducible evaluation walkthrough.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number, decimals = 2): number {
    const v = this.next() * (max - min) + min;
    return Number(v.toFixed(decimals));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Weighted pick: `weights` must align with `items`. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i += 1) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }

  /** Box-Muller normal sample, clamped to [min, max]. */
  normal(mean: number, stdDev: number, min = -Infinity, max = Infinity): number {
    const u1 = Math.max(this.next(), 1e-9);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.min(max, Math.max(min, mean + z * stdDev));
  }

  /** Deterministic RFC-4122-shaped identifier (not cryptographically secure). */
  uuid(): string {
    const hex = '0123456789abcdef';
    let out = '';
    for (let i = 0; i < 36; i += 1) {
      if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
      else if (i === 14) out += '4';
      else if (i === 19) out += hex[(Math.floor(this.next() * 16) & 0x3) | 0x8];
      else out += hex[Math.floor(this.next() * 16)];
    }
    return out;
  }

  dateBetween(start: Date, end: Date): Date {
    const t = start.getTime() + this.next() * (end.getTime() - start.getTime());
    return new Date(t);
  }
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function padCode(prefix: string, index: number, width = 4): string {
  return `${prefix}-${String(index).padStart(width, '0')}`;
}

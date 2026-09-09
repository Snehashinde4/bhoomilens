import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '@/lib/rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(20260909);
    const b = new Rng(20260909);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('respects integer bounds', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i += 1) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('generates RFC-4122 shaped identifiers', () => {
    const rng = new Rng(42);
    expect(rng.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('samples without replacement', () => {
    const rng = new Rng(11);
    const picked = rng.sample(['a', 'b', 'c', 'd'], 3);
    expect(new Set(picked).size).toBe(3);
  });

  it('hashes strings stably', () => {
    expect(hashString('DOC-000001')).toBe(hashString('DOC-000001'));
    expect(hashString('DOC-000001')).not.toBe(hashString('DOC-000002'));
  });
});

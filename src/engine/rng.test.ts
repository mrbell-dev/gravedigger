import { describe, it, expect } from "vitest";
import { makeRng, seedFromString, shuffle, randInt } from "./rng";

describe("seeded RNG", () => {
  it("is deterministic: same seed => same sequence", () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toEqual(b());
  });

  it("stays within [0, 1)", () => {
    const r = makeRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("seedFromString is stable and word-friendly", () => {
    expect(seedFromString("gravedigger")).toEqual(seedFromString("gravedigger"));
    expect(seedFromString("lich")).not.toEqual(seedFromString("wight"));
  });
});

describe("shuffle", () => {
  it("is a permutation (same multiset) and does not mutate input", () => {
    const input = Array.from({ length: 54 }, (_, i) => i);
    const rng = makeRng(42);
    const out = shuffle(input, rng);
    expect(out).toHaveLength(54);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input[0]).toBe(0); // input untouched
  });

  it("same seed => same shuffle", () => {
    const input = Array.from({ length: 54 }, (_, i) => i);
    expect(shuffle(input, makeRng(7))).toEqual(shuffle(input, makeRng(7)));
  });
});

describe("randInt", () => {
  it("stays within [0, n)", () => {
    const rng = makeRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, 17);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(17);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

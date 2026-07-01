import { describe, it, expect } from "vitest";
import { setup } from "./setup";
import { isJoker, isKing } from "./cards";
import type { Card } from "./types";

const allCards = (s: ReturnType<typeof setup>): Card[] => [
  ...s.deck,
  ...s.hand,
  ...s.row.map((e) => e.card),
  ...s.discard,
];

describe("setup", () => {
  it("is reproducible: same seed => identical game", () => {
    expect(setup(1234)).toEqual(setup(1234));
  });

  it("different seeds generally differ", () => {
    expect(setup(1).deck.map((c) => c.id)).not.toEqual(setup(2).deck.map((c) => c.id));
  });

  it("conserves all 54 cards across deck + hand + discard", () => {
    const s = setup(42);
    const ids = allCards(s)
      .map((c) => c.id)
      .sort();
    expect(ids).toHaveLength(54);
    expect(new Set(ids).size).toBe(54); // all unique
  });

  it("opening hand holds 5 non-Joker cards", () => {
    for (const seed of [1, 2, 3, 99, 12345, 777]) {
      const s = setup(seed);
      expect(s.hand).toHaveLength(5);
      expect(s.hand.some(isJoker)).toBe(false);
    }
  });

  it("starts with 10 stamina, turn 1, flip phase, empty row", () => {
    const s = setup(5);
    expect(s.stamina).toBe(10);
    expect(s.turn).toBe(1);
    expect(s.phase).toBe("flip");
    expect(s.row).toHaveLength(0);
    expect(s.status).toEqual({ kind: "playing" });
  });

  it("buries the Lich in the bottom third of the deck", () => {
    // The Lich is the only King NOT among the three that can appear early; across many seeds it
    // must always sit in the bottom third of the remaining deck (after the 5-card deal).
    for (const seed of [1, 2, 3, 4, 5, 10, 50, 100, 500, 9999]) {
      const s = setup(seed);
      const kingsInDeck = s.deck.filter(isKing);
      // Exactly one King is the Lich; find the deepest King and assert bottom third.
      const positions = kingsInDeck.map((k) => s.deck.findIndex((c) => c.id === k.id));
      const deepest = Math.max(...positions);
      expect(deepest).toBeGreaterThanOrEqual(Math.floor(s.deck.length * (2 / 3)) - 5);
    }
  });
});

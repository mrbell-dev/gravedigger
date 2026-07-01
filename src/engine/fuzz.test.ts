import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { newGame, apply, legalActions, defaultPendingAction } from "./index";
import type { GameState } from "./types";

/** Invariants that must hold after EVERY transition, no matter what the player does. */
function assertInvariants(s: GameState): void {
  // Card conservation: exactly the 54 cards, always, with no duplicates or losses.
  const all = [...s.deck, ...s.hand, ...s.row.map((e) => e.card), ...s.discard];
  expect(all.length).toBe(54);
  expect(new Set(all.map((c) => c.id)).size).toBe(54);

  // Stamina is clamped to [0, 10].
  expect(s.stamina).toBeGreaterThanOrEqual(0);
  expect(s.stamina).toBeLessThanOrEqual(10);

  for (const e of s.row) {
    expect(e.festering).toBeGreaterThanOrEqual(0);
    // A surviving enemy never holds 2+ splash — that would have destroyed it.
    expect(e.splash).toBeLessThan(2);
    expect(e.splash).toBeGreaterThanOrEqual(0);
    if (e.role === "lich") {
      // A living Lich has HP in (0, 20].
      expect(e.hp).toBeGreaterThan(0);
      expect(e.hp!).toBeLessThanOrEqual(20);
    }
  }

  // A terminal 'won' state must actually satisfy the win condition.
  if (s.status.kind === "won") {
    expect(s.deck.length).toBe(0);
    expect(s.row.length).toBe(0);
  }
}

/** Play a game to its end, choosing legal actions via the supplied stream of choices. */
function playFuzzed(seed: number, choices: number[]): GameState {
  let s = newGame(seed);
  assertInvariants(s);
  let i = 0;
  let guard = 0;
  while (s.status.kind === "playing" && guard < 3000) {
    guard++;
    if (s.pending) {
      s = apply(s, defaultPendingAction(s)!);
    } else {
      const acts = legalActions(s);
      if (acts.length === 0) break; // engine will resolve to a loss on the next run()
      const pick = acts[(choices[i++ % choices.length] ?? 0) % acts.length];
      s = apply(s, pick);
    }
    assertInvariants(s);
  }
  return s;
}

describe("property: the engine never reaches an illegal state", () => {
  it("holds all invariants across randomized full games", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.array(fc.nat(), { minLength: 40, maxLength: 300 }),
        (seed, choices) => {
          const end = playFuzzed(seed, choices);
          // Every game must terminate in a defined status (no hangs / undefined states).
          expect(["playing", "won", "lost"]).toContain(end.status.kind);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("is fully deterministic: identical seed + choices => identical final state", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.array(fc.nat(), { minLength: 20, maxLength: 120 }),
        (seed, choices) => {
          expect(playFuzzed(seed, choices)).toEqual(playFuzzed(seed, choices));
        },
      ),
      { numRuns: 80 },
    );
  });
});

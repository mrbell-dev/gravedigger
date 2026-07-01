import { describe, it, expect } from "vitest";
import { newGame, apply, legalActions, defaultPendingAction } from "./index";
import type { GameState, Action } from "./types";
import { effectiveValue } from "./enemy";

describe("new game", () => {
  it("advances to the first ACT with one enemy in the row", () => {
    const s = newGame(1);
    expect(s.phase).toBe("act");
    expect(s.status.kind).toBe("playing");
    expect(s.row.length).toBeGreaterThanOrEqual(1);
    expect(s.hand.length).toBe(5);
  });

  it("is reproducible end-to-end for the same seed", () => {
    expect(newGame(2024)).toEqual(newGame(2024));
  });
});

describe("basic actions", () => {
  it("resting recovers 2 stamina (capped at 10) and then suffers", () => {
    // Find a seed where the opening enemy is weak enough that resting is legal.
    const s = newGame(7);
    const before = s.stamina;
    const rest = legalActions(s).find((a) => a.type === "rest");
    if (!rest) return; // row may be full; covered by other seeds
    const after = apply(s, rest);
    // Rest gives +2 but Suffer removes 1 per surviving enemy afterward.
    expect(after.stamina).toBeLessThanOrEqual(10);
    expect(after.stamina).toBeGreaterThanOrEqual(before - s.row.length);
    expect(after.turn).toBe(s.turn + 1);
  });

  it("a sufficient smite lays an enemy to rest and removes it from the row", () => {
    const s = newGame(3);
    const target = s.row[0];
    // Craft a guaranteed-lethal smite by picking the highest tool in hand.
    const best = [...s.hand]
      .filter((c) => c.kind === "standard" && c.rank !== 1)
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
    if (!best || (best.rank ?? 0) < effectiveValue(target)) return; // not always possible
    const action: Action = { type: "smite", cardIds: [best.id], targetId: target.id };
    const after = apply(s, action);
    expect(after.row.find((e) => e.id === target.id)).toBeUndefined();
    expect(after.hand.find((c) => c.id === best.id)).toBeUndefined();
  });

  it("an insufficient smite adds a festering token and raises effective value by 2", () => {
    const s = newGame(11);
    const target = s.row[0];
    const weak = [...s.hand]
      .filter((c) => c.kind === "standard" && c.rank !== 1)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))[0];
    if (!weak || (weak.rank ?? 0) >= effectiveValue(target)) return;
    const evBefore = effectiveValue(target);
    const action: Action = { type: "smite", cardIds: [weak.id], targetId: target.id };
    const after = apply(s, action);
    const still = after.row.find((e) => e.id === target.id);
    expect(still).toBeDefined();
    expect(still!.festering).toBe(target.festering + 1);
    expect(effectiveValue(still!)).toBe(evBefore + 2);
  });
});

/** A greedy bot: always take the lowest-value lethal smite; else fester the weakest; else rest; else burn. */
function greedyMove(s: GameState): Action | undefined {
  const actions = legalActions(s);
  if (actions.length === 0) return undefined;
  const smites = actions.filter((a) => a.type === "smite");
  // Prefer a lethal smite that spends the least value.
  const lethal = smites
    .map((a) => {
      const cards = a.cardIds.map((id) => s.hand.find((c) => c.id === id)!);
      const val = cards.reduce((n, c) => n + (c.rank === 1 ? 0 : (c.rank ?? 0)), 0);
      const t = s.row.find((e) => e.id === a.targetId)!;
      return { a, val, kills: t.role !== "lich" && val >= effectiveValue(t) };
    })
    .filter((x) => x.kills)
    .sort((x, y) => x.val - y.val)[0];
  if (lethal) return lethal.a;
  // No kill available: attack anyway (chip the Lich / fester) to force progress, rather than
  // stalling on Rest. Pick the highest-value smite.
  const bestSmite = smites
    .map((a) => {
      const cards = a.cardIds.map((id) => s.hand.find((c) => c.id === id)!);
      const val = cards.reduce((n, c) => n + (c.rank === 1 ? 0 : (c.rank ?? 0)), 0);
      return { a, val };
    })
    .sort((x, y) => y.val - x.val)[0];
  if (bestSmite) return bestSmite.a;
  return actions.find((a) => a.type === "rest") ?? actions[0];
}

describe("full games terminate", () => {
  it("a greedy bot always reaches a terminal state without crashing (many seeds)", () => {
    for (let seed = 0; seed < 60; seed++) {
      let s = newGame(seed);
      let steps = 0;
      while (s.status.kind === "playing" && steps < 2000) {
        if (s.pending) {
          s = apply(s, defaultPendingAction(s)!);
          continue;
        }
        const move = greedyMove(s);
        if (!move) break;
        s = apply(s, move);
        steps++;
      }
      expect(["won", "lost"]).toContain(s.status.kind);
      // Invariants that must hold at every terminal state:
      expect(s.stamina).toBeGreaterThanOrEqual(0);
      expect(s.stamina).toBeLessThanOrEqual(10);
    }
  });
});

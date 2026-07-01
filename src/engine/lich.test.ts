import { describe, it, expect } from "vitest";
import { apply, isLegal } from "./index";
import { makeEnemy } from "./enemy";
import type { GameState, Card, Suit, Enemy } from "./types";

const C = (suit: Suit, rank: number): Card => ({
  id: `${suit}${rank}`,
  kind: "standard",
  suit,
  rank: rank as Card["rank"],
});
const en = (suit: Suit, rank: number, fest = 0): Enemy => {
  const e = makeEnemy(C(suit, rank), false);
  e.festering = fest;
  return e;
};
const lich = (hp = 20, lichTurns = 0): Enemy => {
  const e = makeEnemy({ id: "KH", kind: "standard", suit: "H", rank: 13 }, true);
  e.hp = hp;
  e.lichTurns = lichTurns;
  return e;
};

const base = (o: Partial<GameState>): GameState => ({
  seed: 0,
  lichId: "KH",
  turn: 1,
  phase: "act",
  deck: [],
  hand: [],
  row: [],
  discard: [],
  stamina: 10,
  ironFlipUsed: false,
  skipFlipNextTurn: false,
  skipSuffer: false,
  status: { kind: "playing" },
  log: [],
  ...o,
});

describe("Lich Corruption", () => {
  it("festers every other enemy on the Lich's EVEN turn", () => {
    // lichTurns=1 now; the coming Suffer makes it 2 (even) => Corruption fires.
    const s = base({ row: [lich(20, 1), en("S", 5)], hand: [C("C", 2)] });
    const after = apply(s, { type: "smite", cardIds: ["C2"], targetId: "KH", chosenSuit: "C" });
    expect(after.row.find((e) => e.id === "S5")!.festering).toBe(1);
  });

  it("does NOT fester on the Lich's ODD turn", () => {
    const s = base({ row: [lich(20, 0), en("S", 5)], hand: [C("C", 2)] });
    const after = apply(s, { type: "smite", cardIds: ["C2"], targetId: "KH", chosenSuit: "C" });
    expect(after.row.find((e) => e.id === "S5")!.festering).toBe(0);
  });

  it("never festers the Lich itself", () => {
    const s = base({ row: [lich(20, 1), en("S", 5)], hand: [C("C", 2)] });
    const after = apply(s, { type: "smite", cardIds: ["C2"], targetId: "KH", chosenSuit: "C" });
    expect(after.row.find((e) => e.role === "lich")!.festering).toBe(0);
  });
});

describe("Lich defeat", () => {
  it("cumulative damage reaching HP destroys it and grants +3 Stamina (capped)", () => {
    const s = base({ stamina: 7, row: [lich(5, 0)], hand: [C("C", 6)] });
    const after = apply(s, { type: "smite", cardIds: ["C6"], targetId: "KH", chosenSuit: "C" });
    expect(after.row.find((e) => e.role === "lich")).toBeUndefined();
    expect(after.stamina).toBe(10); // 7 + 3, capped at 10
  });
});

describe("Lich special rules", () => {
  it("cannot be Burned", () => {
    const s = base({ row: [lich()], hand: [C("C", 2), C("C", 3)] });
    expect(isLegal(s, { type: "burn", cardIds: ["C2", "C3"], targetId: "KH" })).toBe(false);
  });

  it("raises the row limit to 4 — Rest is legal with 3 enemies while the Lich lives", () => {
    const s = base({
      row: [lich(), en("S", 4), en("S", 5)], // 3 enemies, but limit is 4 with the Lich
      hand: [C("C", 2), C("C", 3)],
      deck: [C("D", 2)],
    });
    expect(isLegal(s, { type: "rest" })).toBe(true);
  });
});

// Enemy creation and value math.

import type { Card, Enemy } from "./types";

export const LICH_HP = 20;

/** Turn a flipped card into an Enemy. Caller guarantees it is NOT an Ace or Joker. */
export function makeEnemy(card: Card, isLich: boolean): Enemy {
  if (isLich) {
    return {
      id: card.id,
      card,
      base: LICH_HP,
      festering: 0,
      splash: 0,
      role: "lich",
      hp: LICH_HP,
      lichTurns: 0,
    };
  }
  const isKing = card.rank === 13;
  return {
    id: card.id,
    card,
    base: card.rank!, // 2..13; J=11 Q=12 K=13
    festering: 0,
    splash: 0,
    role: isKing ? "warlord" : "normal",
  };
}

/** Effective value the player must meet or beat to kill (base + 2 per festering token). */
export function effectiveValue(e: Enemy): number {
  return e.base + 2 * e.festering;
}

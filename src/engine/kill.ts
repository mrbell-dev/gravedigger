// Shared "remove an enemy" operations used by Smite, Burn, and the suit powers.

import type { GameState, Enemy } from "./types";
import { log, gainStamina } from "./turn";

/** An enemy is killed by attack value: discard it (and its tokens) and clear the row slot. */
export function layToRest(s: GameState, enemy: Enemy): void {
  s.row = s.row.filter((e) => e.id !== enemy.id);
  s.discard.push(enemy.card);
}

/** An enemy is destroyed by Fire splash reaching 2. */
export function destroyBySplash(s: GameState, enemy: Enemy): void {
  s.row = s.row.filter((e) => e.id !== enemy.id);
  s.discard.push(enemy.card);
  log(s, `Fire consumes an enemy (2 splash).`);
}

/** The Lich is defeated: discard, +3 Stamina, row returns to its normal limit. */
export function defeatLich(s: GameState, lich: Enemy): void {
  s.row = s.row.filter((e) => e.id !== lich.id);
  s.discard.push(lich.card);
  gainStamina(s, 3);
  log(s, "THE LICH is destroyed. +3 Stamina. The row returns to normal.");
}

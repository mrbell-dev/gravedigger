// Difficulty/balance constants in one place (no imports, so any module can use it without cycles).

/**
 * Max/starting Stamina by deck count. Single source of truth.
 * Scales a full 10 per deck (10/20/30/40/50) so higher difficulties aren't cheap attrition deaths —
 * the real challenge at more decks is board-clog (festering), which is a skill test, not a stat wall.
 */
export function maxStamina(decks: number): number {
  return 10 * decks;
}

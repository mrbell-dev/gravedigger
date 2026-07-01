// Win / loss detection and victory tiers.

import type { GameState, Score } from "./types";
import { isAce } from "./cards";
import { toolValue } from "./cards";
import { maxStamina } from "./balance";

const STAMINA_POINTS = 10; // per remaining stamina
const EFFICIENCY_POINTS = 25; // per tool left unused in hand
const CLEAR_BONUS = 100; // flat reward for winning

/**
 * Score a won game. Rewards finishing with high stamina and with tools still in hand (you cleared
 * the graveyard without needing to spend everything). Scaled by difficulty (deck count).
 */
export function scoreWin(state: GameState): Score {
  const unusedCards = state.hand.length; // deck is empty at a win; hand = tools never spent
  const staminaBonus = state.stamina * STAMINA_POINTS;
  const efficiencyBonus = unusedCards * EFFICIENCY_POINTS;
  const difficultyMult = state.decks;
  const total = Math.round((staminaBonus + efficiencyBonus + CLEAR_BONUS) * difficultyMult);
  return { staminaBonus, efficiencyBonus, clearBonus: CLEAR_BONUS, difficultyMult, unusedCards, total };
}

export function victoryTier(stamina: number, decks = 1): "gold" | "silver" | "bronze" {
  const cap = maxStamina(decks);
  if (stamina >= 0.8 * cap) return "gold";
  if (stamina >= 0.5 * cap) return "silver";
  return "bronze";
}

/** Checked after every phase (ruling R4). Sets status to won/lost when appropriate. */
export function checkWinLoss(state: GameState): void {
  if (state.status.kind !== "playing") return;

  if (state.stamina <= 0) {
    state.status = { kind: "lost", reason: "stamina" };
    return;
  }
  // Win: the deck is empty and the row has been fully cleared.
  if (state.deck.length === 0 && state.row.length === 0) {
    state.status = {
      kind: "won",
      tier: victoryTier(state.stamina, state.decks),
      stamina: state.stamina,
      score: scoreWin(state),
    };
  }
}

const isTool = (c: { rank?: number; kind: string }): boolean =>
  c.kind === "standard" && toolValue(c as never) > 0;

/**
 * Ruling R5: at the ACT step, with enemies present, is the player unable to make progress?
 * Productive actions = Smite, Burn, or a festering-clearing Ritual. Rest is NOT an escape
 * (stalling); a do-nothing Ritual is NOT an escape either.
 */
export function isStuck(state: GameState): boolean {
  if (state.row.length === 0) return false; // nothing to fight; will flip/refill/win

  const nonAce = state.hand.filter((c) => !isAce(c) && c.kind === "standard");
  const canSmite = state.hand.some(isTool); // any tool can attack some enemy
  const canBurn = nonAce.length >= 2 && state.row.some((e) => e.role !== "lich");
  const canClearRitual = state.hand.some(isAce) && state.row.some((e) => e.festering > 0);
  if (canSmite || canBurn || canClearRitual) return false;

  // No productive action. Can we legally Rest to draw into something better?
  const rowFull = state.row.length >= (state.row.some((e) => e.role === "lich") ? 4 : 3);
  const restBlocked = rowFull || (state.deck.length === 0 && nonAce.length < 2);
  // Resting only helps if the deck can still feed us new cards.
  const restUseful = !restBlocked && state.deck.length > 0;
  return !restUseful;
}

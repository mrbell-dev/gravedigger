// Card construction and value/name helpers. Pure.

import type { Card, Suit, Rank } from "./types";

export const SUITS: Suit[] = ["S", "C", "H", "D"];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const SUIT_NAME: Record<Suit, string> = {
  S: "Iron",
  C: "Salt",
  H: "Fire",
  D: "Silver",
};

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", C: "♣", H: "♥", D: "♦" };

/** Build the full 54-card deck (52 standard + 2 jokers), in a fixed canonical order. */
export function fullDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${suit}${rank}`, kind: "standard", suit, rank });
    }
  }
  cards.push({ id: "JOKER-A", kind: "joker" });
  cards.push({ id: "JOKER-B", kind: "joker" });
  return cards;
}

export const isJoker = (c: Card): boolean => c.kind === "joker";
export const isAce = (c: Card): boolean => c.kind === "standard" && c.rank === 1;
export const isKing = (c: Card): boolean => c.kind === "standard" && c.rank === 13;

/** Tool value when a card is in hand (Ace has no attack value; jokers never in hand). */
export function toolValue(c: Card): number {
  if (c.kind !== "standard" || c.rank === undefined) return 0;
  if (c.rank === 1) return 0; // Ace: Ritual only, no attack value
  return c.rank; // 2..13 already maps J=11 Q=12 K=13
}

/** The enemy name for a flipped card (before it becomes a Warlord/Lich). */
export function enemyName(rank: Rank): string {
  if (rank >= 2 && rank <= 6) return "Shambler";
  if (rank >= 7 && rank <= 9) return "Revenant";
  if (rank === 10) return "Wight";
  if (rank === 11) return "Haunt";
  if (rank === 12) return "Banshee";
  if (rank === 13) return "Warlord";
  return "Ritual"; // Ace — not actually an enemy
}

/** Short human label, e.g. "Q♥" or "Joker". */
export function cardLabel(c: Card): string {
  if (c.kind === "joker") return "Joker";
  const r = c.rank!;
  const rankStr = r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);
  return `${rankStr}${SUIT_SYMBOL[c.suit!]}`;
}

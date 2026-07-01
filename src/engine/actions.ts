// The action layer: enumerate legal moves and apply a chosen move, then advance the machine.

import type { GameState, Action, Card, Suit } from "./types";
import { isAce, toolValue } from "./cards";
import { effectiveValue } from "./enemy";
import { run, log, rowLimit, gainStamina, discardFromHand } from "./turn";
import { layToRest, defeatLich } from "./kill";
import { fireSuitPower } from "./suits";

/** A single, immutable transition. Returns a NEW state; never mutates the input. */
export function apply(state: GameState, action: Action): GameState {
  const s: GameState = structuredClone(state);
  if (s.status.kind !== "playing") return s;

  // Responses to a pending decision:
  if (action.type === "reorder" || action.type === "salt-remove" || action.type === "discard") {
    if (!s.pending) return s;
    if (action.type === "reorder" && s.pending.kind === "reorder") applyReorder(s, action.newTopOrder);
    else if (action.type === "salt-remove" && s.pending.kind === "salt-remove")
      applySaltRemove(s, action.targetId);
    else if (action.type === "discard" && s.pending.kind === "discard")
      applyDiscard(s, action.cardIds);
    else return s; // action doesn't match the pending decision
    run(s);
    return s;
  }

  if (s.phase !== "act" || s.pending) return s; // not the player's move
  if (!isLegal(s, action)) return s; // ignore illegal actions defensively

  switch (action.type) {
    case "smite":
      resolveSmite(s, action.cardIds, action.targetId, action.chosenSuit);
      break;
    case "ritual":
      resolveRitual(s, action.cardId);
      break;
    case "rest":
      gainStamina(s, 2);
      s.restsUsed += 1;
      log(s, "You Rest. +2 Stamina.");
      s.phase = "suffer";
      break;
    case "burn":
      resolveBurn(s, action.cardIds, action.targetId);
      break;
  }
  run(s);
  return s;
}

// --- Reorder (Omen / Salt) ---

function applyReorder(s: GameState, newTopOrder: string[]): void {
  if (!s.pending || s.pending.kind !== "reorder") return;
  const n = s.pending.count;
  const top = s.deck.slice(0, n);
  const ids = new Set(top.map((c) => c.id));
  // Validate: newTopOrder must be a permutation of the current top-n ids.
  const valid = newTopOrder.length === n && newTopOrder.every((id) => ids.has(id));
  if (valid) {
    const byId = new Map(top.map((c) => [c.id, c]));
    const reordered = newTopOrder.map((id) => byId.get(id)!);
    s.deck.splice(0, n, ...reordered);
  }
  const resume = s.pending.resumePhase;
  s.pending = undefined;
  s.phase = resume;
}

/** Salt: remove one festering token from the chosen enemy. */
function applySaltRemove(s: GameState, targetId: string): void {
  if (!s.pending || s.pending.kind !== "salt-remove") return;
  const target = s.row.find((e) => e.id === targetId);
  if (target && target.festering > 0) {
    target.festering -= 1;
    log(s, "Salt suppresses a festering token.");
  }
  const resume = s.pending.resumePhase;
  s.pending = undefined;
  s.phase = resume;
}

/** Trim an overfull hand to `downTo` by discarding the chosen cards. */
function applyDiscard(s: GameState, cardIds: string[]): void {
  if (!s.pending || s.pending.kind !== "discard") return;
  const need = s.hand.length - s.pending.downTo;
  discardFromHand(s, cardIds.slice(0, Math.max(0, need)));
  if (s.hand.length <= s.pending.downTo) {
    const resume = s.pending.resumePhase;
    s.pending = undefined;
    s.phase = resume;
  }
  // If the player under-discarded, the pending stays until the hand is small enough.
}

/** The engine's default choice for any pending decision — used by bots and the sim, not the UI. */
export function defaultPendingAction(s: GameState): Action | undefined {
  const p = s.pending;
  if (!p) return undefined;
  if (p.kind === "reorder") {
    return { type: "reorder", newTopOrder: s.deck.slice(0, p.count).map((c) => c.id) };
  }
  if (p.kind === "salt-remove") {
    const festered = s.row.filter((e) => e.festering > 0);
    const worst = festered.reduce((a, b) => (b.festering > a.festering ? b : a));
    return { type: "salt-remove", targetId: worst.id };
  }
  // discard: shed the weakest non-Aces first, down to the limit.
  const excess = s.hand.length - p.downTo;
  const ranked = [...s.hand].sort(
    (a, b) => Number(isAce(a)) - Number(isAce(b)) || toolValue(a) - toolValue(b),
  );
  return { type: "discard", cardIds: ranked.slice(0, excess).map((c) => c.id) };
}

// --- Smite ---

function resolveSmite(s: GameState, cardIds: string[], targetId: string, chosenSuit?: Suit): void {
  const cards = cardIds.map((id) => s.hand.find((c) => c.id === id)!).filter(Boolean);
  const attack = cards.reduce((sum, c) => sum + toolValue(c), 0);
  const target = s.row.find((e) => e.id === targetId)!;
  const suit = firingSuit(cards, chosenSuit);
  // Immunity: an enemy suppresses the power of a card matching its own suit (damage still lands).
  const suppressed = suit !== undefined && target.card.suit === suit;

  discardFromHand(s, cardIds); // tools are spent regardless of outcome

  let killed = false;
  if (target.role === "lich") {
    target.hp = (target.hp ?? 0) - attack;
    if (target.hp <= 0) {
      defeatLich(s, target);
      killed = true;
    } else {
      log(s, `You strike the Lich for ${attack}. ${target.hp} HP remains.`);
    }
  } else if (attack >= effectiveValue(target)) {
    layToRest(s, target);
    killed = true;
    log(s, `Attack ${attack} lays the enemy to rest.`);
  } else {
    target.festering += 1;
    log(s, `Attack ${attack} falls short — the enemy festers (+1 token).`);
  }

  if (suit !== undefined && !suppressed) {
    fireSuitPower(s, suit, killed, target);
  } else if (suppressed) {
    log(s, "The enemy is immune — its suit swallows the power.");
  }

  // Advance to Suffer only if no power left work pending (Salt/Omen reorder) or in flight (Silver).
  if (!s.pending && !s.silverDraws) s.phase = "suffer";
}

// --- Ritual (Ace: Last Rites) ---

function resolveRitual(s: GameState, cardId: string): void {
  discardFromHand(s, [cardId]);
  let cleared = 0;
  for (const e of s.row) {
    cleared += e.festering;
    e.festering = 0;
  }
  log(s, `Last Rites — festering cleansed (${cleared} tokens removed).`);
  s.phase = "suffer";
}

// --- Burn ---

function resolveBurn(s: GameState, cardIds: string[], targetId: string): void {
  s.burnsUsed += 1;
  discardFromHand(s, cardIds.slice(0, 2));
  const target = s.row.find((e) => e.id === targetId);
  if (target && target.role !== "lich") {
    s.row = s.row.filter((e) => e.id !== target.id);
    s.discard.push(target.card);
    log(s, "You Burn an enemy from the row. No powers fire.");
  }
  s.phase = "suffer";
}

// --- Legality & enumeration ---

/** True if this action is legal in the current state. */
export function isLegal(s: GameState, action: Action): boolean {
  if (action.type === "reorder" || action.type === "salt-remove" || action.type === "discard") {
    return !!s.pending;
  }
  if (s.phase !== "act" || s.pending) return false;

  switch (action.type) {
    case "smite": {
      const target = s.row.find((e) => e.id === action.targetId);
      if (!target) return false;
      const cards = action.cardIds.map((id) => s.hand.find((c) => c.id === id));
      if (cards.some((c) => !c)) return false;
      return validCombo(cards as Card[]);
    }
    case "ritual":
      return s.hand.some((c) => c.id === action.cardId && isAce(c));
    case "rest":
      return restLegal(s);
    case "burn": {
      const nonAce = action.cardIds
        .map((id) => s.hand.find((c) => c.id === id))
        .filter((c): c is Card => !!c && !isAce(c));
      const target = s.row.find((e) => e.id === action.targetId);
      return nonAce.length >= 2 && !!target && target.role !== "lich";
    }
  }
}

export function restLegal(s: GameState): boolean {
  if (s.row.length >= rowLimit(s)) return false;
  const nonAce = s.hand.filter((c) => !isAce(c));
  if (s.deck.length === 0 && nonAce.length < 2) return false;
  return true;
}

/** A single card, or a legal 2-card combo (same suit, or same rank + different suit). No Aces. */
export function validCombo(cards: Card[]): boolean {
  if (cards.length === 1) {
    const c = cards[0];
    return c.kind === "standard" && !isAce(c);
  }
  if (cards.length === 2) {
    const [a, b] = cards;
    if (a.kind !== "standard" || b.kind !== "standard") return false;
    if (isAce(a) || isAce(b)) return false;
    if (a.id === b.id) return false;
    const sameSuit = a.suit === b.suit;
    const sameRank = a.rank === b.rank && a.suit !== b.suit;
    return sameSuit || sameRank;
  }
  return false;
}

/**
 * The suit power that fires for a Smite (Phase 2 uses this). Single card -> its suit.
 * Same-suit combo -> that suit. Same-rank combo -> the caller's chosen suit.
 */
export function firingSuit(cards: Card[], chosen?: Suit): Suit | undefined {
  if (cards.length === 1) return cards[0].suit;
  if (cards[0].suit === cards[1].suit) return cards[0].suit;
  return chosen; // same-rank combo: player chooses
}

/** Enumerate representative legal actions — used by the sim bot and simple UIs. */
export function legalActions(s: GameState): Action[] {
  if (s.status.kind !== "playing" || s.phase !== "act" || s.pending) return [];
  const out: Action[] = [];
  const tools = s.hand.filter((c) => c.kind === "standard" && !isAce(c));
  const aces = s.hand.filter(isAce);

  // Single-card smites
  for (const t of s.row) {
    for (const c of tools) {
      out.push({ type: "smite", cardIds: [c.id], targetId: t.id, chosenSuit: c.suit });
    }
  }
  // Two-card combos
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const pair = [tools[i], tools[j]];
      if (!validCombo(pair)) continue;
      const suits: (Suit | undefined)[] =
        pair[0].suit === pair[1].suit ? [pair[0].suit] : [pair[0].suit, pair[1].suit];
      for (const t of s.row) {
        for (const suit of suits) {
          out.push({
            type: "smite",
            cardIds: [pair[0].id, pair[1].id],
            targetId: t.id,
            chosenSuit: suit,
          });
        }
      }
    }
  }
  // Rituals
  for (const a of aces) out.push({ type: "ritual", cardId: a.id });
  // Rest
  if (restLegal(s)) out.push({ type: "rest" });
  // Burn (each non-Ace pair × each non-Lich target)
  if (tools.length >= 2) {
    for (let i = 0; i < tools.length; i++) {
      for (let j = i + 1; j < tools.length; j++) {
        for (const t of s.row) {
          if (t.role === "lich") continue;
          out.push({ type: "burn", cardIds: [tools[i].id, tools[j].id], targetId: t.id });
        }
      }
    }
  }
  return out;
}

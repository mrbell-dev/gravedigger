// The complete data model for a Gravedigger game. Pure data — no behavior here.

export type Suit = "S" | "C" | "H" | "D"; // Spades(Iron) Clubs(Salt) Hearts(Fire) Diamonds(Silver)

/** Rank as a number: 1=Ace, 2..10, 11=Jack, 12=Queen, 13=King. Jokers have no rank. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** A physical card. `id` is stable and unique for the whole game (for UI keys + replays). */
export interface Card {
  id: string;
  kind: "standard" | "joker";
  suit?: Suit; // absent on jokers
  rank?: Rank; // absent on jokers
}

/** An enemy occupying a slot in the Graveyard Row. */
export interface Enemy {
  id: string; // inherits the source card's id
  card: Card; // the card that spawned it (King for Lich/Warlord)
  base: number; // base value: 2..13 (Lich uses hp instead)
  festering: number; // tokens; +2 each to effective value
  splash: number; // Fire splash accumulated; 2 => destroyed
  role: "normal" | "warlord" | "lich";
  hp?: number; // Lich only: remaining of 20
  lichTurns?: number; // Lich only: turns spent in the row (for Corruption)
}

export type Phase = "flip" | "act" | "suffer" | "refill";

/** A player decision the engine is paused on. `resumePhase` is where the machine continues after. */
export type Pending =
  | {
      kind: "reorder"; // Omen (top 5) or Salt's peek (top 2)
      count: number;
      source: "omen" | "salt-peek";
      skipSufferAfter: boolean; // Omen in Flip/Iron-flip skips Suffer; via Silver/Refill it does not
      resumePhase: Phase;
    }
  | { kind: "salt-remove"; resumePhase: Phase } // Salt: choose which enemy loses a festering token
  | { kind: "discard"; downTo: number; resumePhase: Phase }; // trim an overfull hand by choice

export type Status =
  | { kind: "playing" }
  | { kind: "won"; tier: "gold" | "silver" | "bronze"; stamina: number }
  | { kind: "lost"; reason: "stamina" | "no-legal-action" };

/** The entire game state. Everything needed to render or resume is here. */
export interface GameState {
  seed: number;
  decks: number; // how many 54-card decks were shuffled in (1–5) — the difficulty knob
  lichId: string; // which King is the Lich (buried in the deck at setup)
  turn: number; // increments each full turn; starts at 1
  phase: Phase;

  deck: Card[]; // index 0 = TOP of the deck (next to be flipped/drawn)
  hand: Card[];
  row: Enemy[];
  discard: Card[];

  stamina: number; // 0..10

  // A player decision the engine is waiting on (Omen/Salt reorder of the top-N of the deck).
  // While set, the only legal action is { type: "reorder" }.
  pending?: Pending;

  // Per-turn flags, reset at the start of each Flip:
  ironFlipUsed: boolean; // Iron chain-flip fires at most once per turn
  skipFlipNextTurn: boolean; // an Iron chain-flip consumed the *next* turn's Flip
  skipSuffer: boolean; // set by a Joker revealed in Flip / Iron-flip
  silverDraws?: number; // cards still owed by Silver's mid-Act draw (resumable across an Omen)

  status: Status;

  log: GameEvent[]; // human-readable event trail for UI + debugging
}

/** A structured, replayable log entry. `text` is the player-facing line. */
export interface GameEvent {
  turn: number;
  phase: Phase;
  text: string;
}

// --- Actions the player can take during the ACT phase ---

export type Action =
  | { type: "smite"; cardIds: string[]; targetId: string; chosenSuit?: Suit } // 1 or 2 cards
  | { type: "ritual"; cardId: string } // play an Ace
  | { type: "rest" }
  | { type: "burn"; cardIds: string[]; targetId: string } // discard 2 non-Ace cards, remove 1 enemy
  // Responses to a `Pending` decision:
  | { type: "reorder"; newTopOrder: string[] } // top-N of deck (Omen / Salt peek)
  | { type: "salt-remove"; targetId: string } // which enemy loses a festering token
  | { type: "discard"; cardIds: string[] }; // which cards to shed from an overfull hand

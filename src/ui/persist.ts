// Local persistence: resume an in-progress game, track lifetime stats, and share/enter seeds.
// Everything lives in localStorage — no backend, no accounts.

import type { GameState, Status } from "../engine";
import { seedFromString } from "../engine";

const GAME_KEY = "gd-savegame-v1";
const STATS_KEY = "gd-stats-v1";

// --- In-progress game ---

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(s));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    // Only resume games still in progress; sanity-check the shape.
    if (s?.status?.kind === "playing" && Array.isArray(s.hand) && Array.isArray(s.row)) return s;
    return null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    /* non-fatal */
  }
}

// --- Lifetime stats ---

export const MAX_DECKS = 5;

export interface Stats {
  played: number;
  wins: number;
  gold: number;
  silver: number;
  bronze: number;
  streak: number;
  bestStreak: number;
  unlocked: number; // highest difficulty (deck count) unlocked; starts at 1
}

const EMPTY: Stats = {
  played: 0,
  wins: 0,
  gold: 0,
  silver: 0,
  bronze: 0,
  streak: 0,
  bestStreak: 0,
  unlocked: 1,
};

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Stats>) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

/** Record a finished game. Returns the updated stats. Call exactly once per game end. */
export function recordResult(status: Status, decks: number): Stats {
  const st = loadStats();
  st.played += 1;
  if (status.kind === "won") {
    st.wins += 1;
    st[status.tier] += 1;
    st.streak += 1;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    // Winning at difficulty D unlocks D+1 (up to the maximum).
    st.unlocked = Math.max(st.unlocked, Math.min(MAX_DECKS, decks + 1));
  } else {
    st.streak = 0;
  }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(st));
  } catch {
    /* non-fatal */
  }
  return st;
}

// --- Seeds & sharing ---

/** Turn user input (a number, or any word/phrase) into a deterministic numeric seed. */
export function parseSeedInput(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s) >>> 0;
  return seedFromString(s.toLowerCase());
}

/** Read a ?seed= override from the URL (number or word), or null. */
export function seedFromUrl(): number | null {
  try {
    const p = new URLSearchParams(location.search).get("seed");
    return p ? parseSeedInput(p) : null;
  } catch {
    return null;
  }
}

/** Read a ?decks= override from the URL (1–5), or null. */
export function decksFromUrl(): number | null {
  try {
    const p = new URLSearchParams(location.search).get("decks");
    if (!p || !/^\d+$/.test(p)) return null;
    return Math.max(1, Math.min(MAX_DECKS, Number(p)));
  } catch {
    return null;
  }
}

/** Remove ?seed= and ?decks= from the address bar so a later refresh resumes normally. */
export function clearSeedFromUrl(): void {
  try {
    const url = new URL(location.href);
    url.searchParams.delete("seed");
    url.searchParams.delete("decks");
    history.replaceState(null, "", url.toString());
  } catch {
    /* non-fatal */
  }
}

/** A shareable link that starts this exact graveyard (seed + difficulty). */
export function shareLink(seed: number, decks: number): string {
  try {
    const url = new URL(location.href);
    url.searchParams.set("seed", String(seed >>> 0));
    if (decks > 1) url.searchParams.set("decks", String(decks));
    return url.toString();
  } catch {
    return `?seed=${seed >>> 0}${decks > 1 ? `&decks=${decks}` : ""}`;
  }
}

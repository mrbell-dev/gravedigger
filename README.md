# Gravedigger

> *A cursed cemetery. The dead keep rising. You are the only thing standing between them and the
> living — armed with iron, salt, fire, and silver. Work fast. The longer they fester, the harder
> they fall.*

A gothic single-player solitaire card game, played with a standard 54-card deck. This is a
mobile-first, installable web version — it runs entirely in your browser, works offline, and can be
added to your phone's home screen for full-screen play.

**▶ Play: https://mrbell-dev.github.io/gravedigger/**

---

## Credits

**Game created and designed by [@Pavornic](https://github.com/Pavornic).** *Gravedigger* — its
rules, mechanics, enemies, and world — is his creation.

Digital implementation by [@mrbell-dev](https://github.com/mrbell-dev).

All rights to the game design and its content are reserved by the creator. This repository is
published for review and play only — it is **not** offered under an open-source license. See
[`LICENSE`](LICENSE). Please don't reuse or redistribute the game, its rules, text, art, or code
without permission.

> Note: copyright protects this repository's specific expression (code, rule text, artwork, names) —
> it does not protect abstract game mechanics, which are not copyrightable. The name can be protected
> by trademark; the code and text by this license.

---

## How to play

Each turn: **Flip** a card from the graveyard → **Act** → **Suffer** → **Refill** your hand.

- **Tools** (cards in hand) are played to **Smite** enemies. Meet or beat an enemy's value to lay it
  to rest; fall short and it *festers* (gets stronger).
- Each suit carries a power — ♠ **Iron**, ♣ **Salt**, ♥ **Fire**, ♦ **Silver**.
- **Aces** are Rituals (cleanse festering); **Jokers** are Omens (peek and reorder the deck).
- Survive the deck, clear the row, and don't let your **Stamina** hit zero. Beware **The Lich**.

Full rules are in-app (tap the **?**) and in [`src/engine/RULES.md`](src/engine/RULES.md).

## Features

- Faithful, fully-tested rules engine (the tricky bookkeeping — festering, splash, Lich Corruption,
  Iron's chain-flip — is enforced for you).
- Installable **PWA**: full-screen, **works offline** after the first load.
- **Seed sharing** — send a link (or a word) that starts the exact same graveyard.
- Autosave & resume, lifetime stats, victory tiers.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # rules engine test suite (Vitest)
npm run build      # production build (static site in dist/)
npm run sim -- 4000  # headless balance simulator
```

The engine (`src/engine/`) is a pure, deterministic, framework-free state machine; the React UI
(`src/ui/`) only renders state and dispatches actions. See [`CLAUDE.md`](CLAUDE.md) and
[`PLAN.md`](PLAN.md) for architecture and roadmap.

## Tech

TypeScript · React · Vite · Vitest · vite-plugin-pwa. Deployed to GitHub Pages via GitHub Actions.

Third-party asset licenses are listed in [`ASSETS.md`](ASSETS.md).

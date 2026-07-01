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

## Open-source acknowledgements

The *game design* is @Pavornic's and is all rights reserved. The **digital implementation** gratefully
uses these open-source projects and assets:

**Fonts** (self-hosted via [Fontsource](https://fontsource.org), so the app works offline):
- [**Pirata One**](https://fonts.google.com/specimen/Pirata+One) — SIL Open Font License 1.1 (titles).
- [**EB Garamond**](https://fonts.google.com/specimen/EB+Garamond) — SIL Open Font License 1.1 (body).

**Libraries:**
- [React](https://react.dev) & React DOM — MIT
- [Vite](https://vitejs.dev) & [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) — MIT
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) & [Workbox](https://developer.chrome.com/docs/workbox) — MIT
- [marked](https://marked.js.org/) (renders the in-app rules) — MIT
- [Vitest](https://vitest.dev), [fast-check](https://fast-check.dev), [Playwright](https://playwright.dev), [tsx](https://github.com/privatenumber/tsx), [TypeScript](https://www.typescriptlang.org) *(dev tooling)* — MIT / Apache-2.0

**Sound & haptics:** procedurally generated in-browser via the Web Audio API and the Vibration API —
no third-party audio files. App icon and suit glyphs are original artwork for this project.

A machine-readable list is also in [`ASSETS.md`](ASSETS.md). If any attribution is missing or wrong,
please open an issue.

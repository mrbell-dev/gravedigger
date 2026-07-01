# Third-party assets & licenses

The **game design** of *Gravedigger* is the creation of [@Pavornic](https://github.com/Pavornic)
and is **all rights reserved** (see README). The items below are third-party assets used in the
digital implementation, under their own open licenses.

## Fonts (self-hosted via [Fontsource](https://fontsource.org))

- **Pirata One** — SIL Open Font License 1.1. Used for titles/headings.
- **EB Garamond** — SIL Open Font License 1.1. Used for body text.

Both are bundled locally (latin subset) so the app works fully offline.

## Icons

- App icon (`src/assets/icon.svg`) — original artwork for this project.
- Suit symbols and UI glyphs — Unicode / inline SVG authored for this project.

## Libraries

See `package.json`. Notable runtime/build dependencies and their licenses:

- **React**, **React DOM** — MIT
- **Vite**, **@vitejs/plugin-react** — MIT
- **vite-plugin-pwa** / **Workbox** — MIT
- **marked** (renders the in-app rules) — MIT
- **Vitest**, **fast-check**, **Playwright**, **tsx**, **TypeScript** (dev only) — MIT / Apache-2.0

If any attribution here is incomplete or incorrect, please open an issue.

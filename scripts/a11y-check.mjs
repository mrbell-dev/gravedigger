// Lightweight accessibility smoke test: cards/enemies are labeled, focusable, and keyboard-operable.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5202;
const URL = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});

async function waitForServer(ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server did not start");
}

const checks = [];
const expect = (name, cond) => checks.push({ name, ok: !!cond });

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForSelector(".hand .card");

  const firstCard = page.locator(".hand .card").first();
  expect("card has role=button", (await firstCard.getAttribute("role")) === "button");
  expect("card is focusable (tabindex 0)", (await firstCard.getAttribute("tabindex")) === "0");
  const label = await firstCard.getAttribute("aria-label");
  expect("card has a descriptive aria-label", label && /of (Spades|Clubs|Hearts|Diamonds)|Ritual|Joker/.test(label));

  const enemy = page.locator(".enemy").first();
  expect("enemy has role=button", (await enemy.getAttribute("role")) === "button");
  expect("enemy has aria-label", !!(await enemy.getAttribute("aria-label")));

  const log = page.locator(".log");
  expect("chronicle log is a live region", (await log.getAttribute("aria-live")) === "polite");

  // Keyboard: focus the first card and activate it with Enter → aria-pressed flips to true.
  await firstCard.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect("Enter selects a focused card", (await firstCard.getAttribute("aria-pressed")) === "true");

  // Icon buttons are labeled.
  expect("menu button labeled", !!(await page.locator(".menu-btn").getAttribute("aria-label")));
  expect("help button labeled", !!(await page.locator(".help-btn").getAttribute("aria-label")));

  await browser.close();
} catch (e) {
  console.error("A11Y CHECK ERROR:", e.message);
  checks.push({ name: "ran without error", ok: false });
} finally {
  server.kill("SIGTERM");
}

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.name}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} a11y checks passed`);
process.exit(pass === checks.length ? 0 : 1);

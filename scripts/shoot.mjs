// Self-contained visual check: build must be run first. Starts `vite preview`, drives the game
// with Playwright, and writes screenshots to ./shots. Kills the server on exit.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
mkdirSync("shots", { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server did not start");
}

async function settle(page) {
  // Fonts come from a CDN that may be unreachable in this sandbox; don't block on it.
  await page.waitForSelector(".hand .card", { timeout: 8000 });
  await page.waitForTimeout(500);
}

try {
  await waitForServer();
  const browser = await chromium.launch();

  // Desktop
  const desktop = await browser.newContext({ viewport: { width: 760, height: 1024 } });
  const dp = await desktop.newPage();
  await dp.goto(URL, { waitUntil: "load" });
  await settle(dp);
  await dp.screenshot({ path: "shots/desktop-fresh.png", fullPage: true });

  // Mobile — fresh, then select a card, then Smite
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const mp = await mobile.newPage();
  await mp.goto(URL, { waitUntil: "load" });
  await settle(mp);
  await mp.screenshot({ path: "shots/mobile-fresh.png", fullPage: true });

  // Quick Reference (swipe panel — reached via the second dot), then back to Chronicle.
  const dots = mp.locator(".dot");
  if ((await dots.count()) > 1) {
    await dots.nth(1).click();
    await mp.waitForTimeout(250);
    await mp.screenshot({ path: "shots/mobile-quickref.png", fullPage: true });
    await dots.nth(0).click();
  }

  // Burn armed, with two cards marked for sacrifice.
  try {
    await mp.locator("button.btn", { hasText: "Burn" }).click();
    await mp.locator(".hand .card").nth(0).click();
    await mp.locator(".hand .card").nth(1).click();
    await mp.waitForTimeout(250);
    await mp.screenshot({ path: "shots/mobile-burn.png", fullPage: true });
  } catch {
    /* best effort */
  }
  await mp.reload({ waitUntil: "load" });
  await settle(mp);

  // Add-to-Home-Screen prompt
  const banner = mp.locator(".install-banner");
  if (await banner.count()) {
    await banner.click();
    await mp.waitForTimeout(300);
    await mp.screenshot({ path: "shots/mobile-install.png", fullPage: false });
    await mp.getByText("Later").click();
    await mp.waitForTimeout(200);
  }

  // How-to-Play screen
  await mp.locator(".help-btn").click();
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: "shots/mobile-help.png", fullPage: false });
  await mp.getByText("Close").click();
  await mp.waitForTimeout(200);

  // Select a card — shows the attack-value hint and killable/tough enemy highlighting.
  await mp.locator(".hand .card").first().click();
  await mp.waitForTimeout(250);
  await mp.screenshot({ path: "shots/mobile-selected.png", fullPage: true });

  // Take a few greedy actions to reach a more "played" board state. Best-effort: if a modal or
  // game-over overlay intercepts a click, just stop and screenshot whatever we have.
  try {
    for (let i = 0; i < 6; i++) {
      if (await mp.locator(".overlay").count()) break; // a modal is open — don't fight it
      const enemy = mp.locator(".enemy").first();
      const card = mp.locator(".hand .card").first();
      if ((await card.count()) === 0 || (await enemy.count()) === 0) break;
      await card.click({ timeout: 2000 });
      await enemy.click({ timeout: 2000 });
      await mp.waitForTimeout(200);
    }
  } catch {
    /* best-effort playthrough for the screenshot; ignore */
  }
  await mp.screenshot({ path: "shots/mobile-played.png", fullPage: true });

  await browser.close();
  console.log("screenshots written to ./shots");
} finally {
  server.kill("SIGTERM");
}

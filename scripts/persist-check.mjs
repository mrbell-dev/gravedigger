// Proves a game resumes after a full page reload, and captures the menu/ledger screenshot.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5201;
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

const turnValue = (page) => page.locator(".stat", { hasText: "Turn" }).locator(".v").innerText();

let ok = false;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Deterministic graveyard via shared seed link.
  await page.goto(`${URL}?seed=gravetest`, { waitUntil: "load" });
  await page.waitForSelector(".hand .card");

  const turn1 = await turnValue(page);
  await page.getByText("Rest", { exact: true }).click(); // benign move: advances the turn, game continues
  await page.waitForTimeout(200);
  const turnAfter = await turnValue(page);

  // Capture the menu/ledger while we're here.
  await page.locator(".menu-btn").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "shots/mobile-menu.png", fullPage: false });
  await page.getByText("Close").click();

  // Full reload — must resume the SAME game, not start a fresh turn 1.
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".hand .card");
  const turnResumed = await turnValue(page);

  ok = turn1 === "1" && turnAfter === "2" && turnResumed === "2";
  console.log(
    `RESUME: turn ${turn1} -> after Rest ${turnAfter} -> after reload ${turnResumed} => ${ok ? "PASS" : "FAIL"}`,
  );
  await browser.close();
} catch (e) {
  console.error("PERSIST CHECK FAILED:", e.message);
} finally {
  server.kill("SIGTERM");
  process.exit(ok ? 0 : 1);
}

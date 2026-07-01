// Proves the installed PWA works with no network: load once online (service worker precaches),
// then go fully offline and reload — the game must still boot and be playable.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 5200;
const URL = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* not up */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server did not start");
}

let ok = false;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1) First load (online): register + activate the service worker, let it precache.
  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(2000); // give Workbox time to precache all assets

  // 2) Go fully offline and reload from scratch.
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "load" });

  // 3) The game must still render its hand of cards — proof the app booted with no network.
  await page.waitForSelector(".hand .card", { timeout: 8000 });
  const cards = await page.locator(".hand .card").count();
  const title = await page.locator(".title").innerText();
  await page.screenshot({ path: "shots/offline-proof.png", fullPage: true });

  ok = cards === 5 && title.toLowerCase().includes("gravedigger");
  console.log(`OFFLINE RELOAD: title="${title}", hand cards=${cards} => ${ok ? "PASS" : "FAIL"}`);

  await browser.close();
} catch (e) {
  console.error("OFFLINE CHECK FAILED:", e.message);
} finally {
  server.kill("SIGTERM");
  process.exit(ok ? 0 : 1);
}

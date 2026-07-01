// Rasterize src/assets/icon.svg into the PNG icons a PWA needs, using Playwright's Chromium.
// Outputs to ./public so Vite serves them at the site root.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const svg = readFileSync("src/assets/icon.svg", "utf8");
mkdirSync("public", { recursive: true });

// Also drop the raw SVG as a scalable favicon.
writeFileSync("public/favicon.svg", svg);

const sizes = [
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
  { file: "public/apple-touch-icon.png", size: 180 }, // iOS home-screen icon
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size } of sizes) {
  await page.setViewportSize({ width: size, height: size });
  const html = `<!doctype html><html><body style="margin:0">
    <div style="width:${size}px;height:${size}px">${svg.replace(
      /width="512" height="512"/,
      `width="${size}" height="${size}"`,
    )}</div></body></html>`;
  await page.setContent(html);
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
  console.log("wrote", file);
}
await browser.close();

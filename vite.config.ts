/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./" keeps asset + PWA paths relative so the same build works at any GitHub Pages subpath.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      // Precache fonts too (not in Workbox's default globs) so offline looks identical.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,woff}"],
      },
      manifest: {
        name: "Gravedigger",
        short_name: "Gravedigger",
        description: "A gothic solitaire card game — hold the line against the rising dead.",
        theme_color: "#140f0c",
        background_color: "#140f0c",
        display: "standalone", // full-screen, no browser chrome, when launched from the home screen
        orientation: "portrait",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// LOCAL_ONLY=1 で Workers AI などのリモートバインディングを使わずに起動（E2E テスト用、AI はモック）
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare({ remoteBindings: process.env.LOCAL_ONLY !== "1" })],
  server: { port: 5173, strictPort: true },
});

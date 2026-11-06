import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.API_PROXY ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": apiTarget } },
  preview: { proxy: { "/api": apiTarget } },
});

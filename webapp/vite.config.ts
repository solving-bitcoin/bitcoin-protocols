import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { protocolWorkspace } from "./dev/protocol-workspace"

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    protocolWorkspace(path.resolve(__dirname, "../protocols")),
  ],
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

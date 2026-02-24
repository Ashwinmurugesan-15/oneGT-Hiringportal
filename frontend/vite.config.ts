import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Proxy all /api and /uploads requests to the Python FastAPI backend
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    "process.env": {},
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Shim Next.js navigation hooks for legacy pages
      "next/navigation": path.resolve(__dirname, "./src/shims/next-navigation.tsx"),
      "next/link": path.resolve(__dirname, "./src/shims/next-link.tsx"),
      "next/font/google": path.resolve(__dirname, "./src/shims/next-font.ts"),
      "next/cache": path.resolve(__dirname, "./src/shims/next-cache.ts"),
    },
  },
}));


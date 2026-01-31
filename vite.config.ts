import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps only in development
    sourcemap: mode === "development",
    // Minification settings
    minify: mode === "production" ? "esbuild" : false,
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - stable, heavily cached
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-slider",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-animation": ["framer-motion"],
          // Heavy modules - loaded on demand
          "mediapipe": ["@mediapipe/tasks-vision"],
        },
      },
    },
    // Increase chunk size warning limit (already splitting well)
    chunkSizeWarningLimit: 600,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
    ],
    // Exclude heavy deps that are lazy-loaded
    exclude: ["@mediapipe/tasks-vision"],
  },
}));

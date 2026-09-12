import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths allow the same build to work at any GitHub Pages
  // repository URL without hard-coding the repository name.
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) =>
          id.includes("/node_modules/three/") ? "three" : undefined,
      },
    },
  },
});

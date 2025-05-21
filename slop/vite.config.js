import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/slop",
  optimizeDeps: {
    exclude: ["@babylonjs/havok"]
  }
});

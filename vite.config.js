import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  plugins: [
    glsl({
      root: "/src",
    }),
    VitePWA({
      injectRegister: "inline",
      registerType: "autoUpdate",
      srcDir: "src",
      filename: "sw.ts",
      strategies: "injectManifest",
      injectManifest: {
        maximumFileSizeToCacheInBytes: 1_048_576 * 20,
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
});

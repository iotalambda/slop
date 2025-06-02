import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/slop/",
  optimizeDeps: {
    exclude: ["@babylonjs/havok"]
  },
  plugins: [
    VitePWA({
      injectRegister: 'inline',
      registerType: 'autoUpdate',
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ]
});

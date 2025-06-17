import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

let handler: ServiceWorkerMLCEngineHandler;

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      handler = new ServiceWorkerMLCEngineHandler();

      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          const device = await adapter.requestDevice();
          device.addEventListener("uncapturederror", async (event) => {
            console.error("SLOP: WebGPU uncaptured error");
            const error = (event as any).error ?? { info: "event.error is not set" };
            console.error(error);
            for (const client of await self.clients.matchAll()) {
              client.postMessage({
                ...error,
                type: "sloperror",
              });
            }
          });
        }
      }
    })()
  );
});

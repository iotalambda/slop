import { ServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);

let handler: ServiceWorkerMLCEngineHandler;

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("message", function (e) {
  if (e.data === "ping") {
    e.source?.postMessage("pong");
  }
});

self.addEventListener("activate", function (e) {
  handler = new ServiceWorkerMLCEngineHandler();
});

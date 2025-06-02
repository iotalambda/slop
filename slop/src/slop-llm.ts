import { CreateServiceWorkerMLCEngine, MLCEngineInterface } from "@mlc-ai/web-llm";

export const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export async function createMLCEngine(onProgress: (progress: number) => void): Promise<"sw-failed" | "engine-failed" | MLCEngineInterface> {
  if ("serviceWorker" in navigator) {
    try {
      const sw = await navigator.serviceWorker.getRegistration(new URL("dev-sw.ts", import.meta.url));
      if (!sw) {
        console.error("SLOP: sw registration not found");
        return "sw-failed";
      }

      if (!sw.active) {
        console.error("SLOP: sw not active");
        return "sw-failed";
      }

      await sw.update();

      const ac = new AbortController();
      const pong = await new Promise(function (res) {
        const timeout = setTimeout(() => ac.abort("SLOP: Timeout"), 1000);
        navigator.serviceWorker.addEventListener(
          "message",
          (e) => {
            clearTimeout(timeout);
            res(e.data);
          },
          { once: true }
        );
        sw.active?.postMessage("ping");
      });
      if (pong !== "pong") {
        console.error("SLOP: sw ping failed");
        return "sw-failed";
      }
    } catch (error) {
      console.error(error);
      return "sw-failed";
    }
  } else {
    console.error("SLOP: sw not supported");
    return "sw-failed";
  }

  try {
    const engine: MLCEngineInterface = await CreateServiceWorkerMLCEngine(MODEL, {
      initProgressCallback: (r) => onProgress(r.progress),
    });
    return engine;
  } catch (error) {
    console.error("SLOP: engine failed");
    console.error(error);
    return "engine-failed";
  }
}

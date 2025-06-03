import { CreateServiceWorkerMLCEngine, InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";

export const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export async function createMLCEngine(onProgress: (progress: InitProgressReport) => void): Promise<"sw-failed" | "engine-failed" | MLCEngineInterface> {
  let reg: ServiceWorkerRegistration;
  if ("serviceWorker" in navigator) {
    try {
      const regOrFalse = await Promise.race([navigator.serviceWorker.ready, new Promise<false>((res) => setTimeout(() => res(false), 3000))]);

      if (regOrFalse === false) {
        console.error("SLOP: sw did not get ready on time");
        return "sw-failed";
      }

      reg = regOrFalse;

      if (!reg) {
        console.error("SLOP: sw not found");
        return "sw-failed";
      }

      if (!reg.active) {
        console.error("SLOP: sw not active");
        return "sw-failed";
      }

      await reg.update();
    } catch (error) {
      console.error("SLOP: sw failed");
      console.error(error);
      return "sw-failed";
    }
  } else {
    console.error("SLOP: sw not supported");
    return "sw-failed";
  }

  try {
    let timeout: number;
    const timeoutPromise = new Promise<false>((res) => (timeout = setTimeout(() => res(false), 5000)));
    const engineOrFalse = await Promise.race([
      CreateServiceWorkerMLCEngine(MODEL, {
        initProgressCallback: (p) => {
          clearTimeout(timeout);
          onProgress(p);
        },
      }),
      timeoutPromise,
    ]);

    if (engineOrFalse === false) {
      await reg.unregister();
      location.reload();
      return (await new Promise(() => {})) as never;
    }

    return engineOrFalse;
  } catch (error) {
    console.error("SLOP: engine failed");
    console.error(error);
    return "engine-failed";
  }
}

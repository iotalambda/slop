import {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionRequest,
  ChatCompletionUserMessageParam,
  CreateServiceWorkerMLCEngine,
  InitProgressReport,
  MLCEngineInterface,
} from "@mlc-ai/web-llm";
import { SlopTool } from "./slop-tool";

export const MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";
// export const MODEL = "Hermes-3-Llama-3.1-8B-q4f16_1-MLC";

export async function createMLCEngineOrFalse(onProgress: (progress: InitProgressReport) => void): Promise<MLCEngineInterface | false> {
  let reg: ServiceWorkerRegistration;
  if ("serviceWorker" in navigator) {
    try {
      const regOrFalse = await Promise.race([navigator.serviceWorker.ready, new Promise<false>((res) => setTimeout(() => res(false), 3000))]);

      if (regOrFalse === false) {
        console.error("SLOP: sw did not get ready on time");
        return false;
      }

      reg = regOrFalse;

      if (!reg) {
        console.error("SLOP: sw not found");
        return false;
      }

      if (!reg.active) {
        console.error("SLOP: sw not active");
        return false;
      }

      await reg.update();
    } catch (error) {
      console.error("SLOP: sw failed");
      console.error(error);
      return false;
    }
  } else {
    console.error("SLOP: sw not supported");
    return false;
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
      console.log("SLOP: could not get engine. Restarting...");
      await reg.unregister();
      location.reload();
      return (await new Promise(() => {})) as never;
    }

    return engineOrFalse;
  } catch (error) {
    console.error("SLOP: engine failed");
    console.error(error);
    if ((error as string).includes("There is no active service worker")) {
      console.log("SLOP: there is no active service worker. Restarting...");
      await reg.unregister();
      location.reload();
      return (await new Promise(() => {})) as never;
    }

    return false;
  }
}

export const SLOP_LLM_MLCMODELS = ["Llama-3.2-1B-Instruct-q4f32_1-MLC", "Hermes-3-Llama-3.1-8B-q4f16_1-MLC"] as const;
export type SlopLLMMLCModel = (typeof SLOP_LLM_MLCMODELS)[number];

export class SlopLLM {
  config?: {
    kind: "MLC";
    mlcEngine: MLCEngineInterface;
    mlcMaxTokens: number;
    mlcModel: SlopLLMMLCModel;
    mlcSystemPrompt: string;
  };
  #slopTool: SlopTool;

  constructor(slopTool: SlopTool) {
    this.#slopTool = slopTool;
  }

  configMLC(mlcEngine: MLCEngineInterface, mlcModel: SlopLLMMLCModel, mlcMaxTokens: number = 4096) {
    let mlcSystemPrompt: string;
    switch (mlcModel) {
      case "Hermes-3-Llama-3.1-8B-q4f16_1-MLC":
        mlcSystemPrompt = createSystemPrompt(HERMES_3_LLAMA_3_1_8B_Q4F16_1_MLC_SYSTEMPROMPTTEMPLATE);
        break;
      case "Llama-3.2-1B-Instruct-q4f32_1-MLC":
        mlcSystemPrompt = createSystemPrompt(LLAMA_3_2_1B_INSTRUCT_Q4F32_1_MLC_SYSTEMPROMPTTEMPLATE);
        break;
    }

    if (!mlcSystemPrompt) {
      console.error("SLOP: no mlc system prompt");
      throw new Error("SLOP: no mlc system prompt");
    }

    this.config = {
      kind: "MLC",
      mlcEngine: mlcEngine,
      mlcMaxTokens: mlcMaxTokens,
      mlcModel: mlcModel,
      mlcSystemPrompt: mlcSystemPrompt,
    };
  }

  async promptMlcTrueOrMessage(
    userMessage: string,
    onProgress: ((progress: { kind: "InvokingChatCompletionsCreate"; attempt: number }) => void) | undefined = undefined
  ): Promise<true | string> {
    if (this.config?.kind !== "MLC") {
      console.error("SLOP: mlc not configured");
      throw new Error("SLOP: mlc not configured");
    }

    const maxAttempts =
      this.config.mlcModel === "Hermes-3-Llama-3.1-8B-q4f16_1-MLC" ? 1 : this.config.mlcModel === "Llama-3.2-1B-Instruct-q4f32_1-MLC" ? 3 : (false as never);
    let attempt = 0;
    const followupMessages: ChatCompletionMessageParam[] = [];
    while (true) {
      attempt++;
      const llmRequest: ChatCompletionRequest = {
        messages: [
          {
            role: "system",
            content: this.config.mlcSystemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
          ...followupMessages,
        ],
        max_tokens: this.config.mlcMaxTokens,
      };
      followupMessages.length = 0;

      let choices: ChatCompletion.Choice[];
      try {
        if (onProgress) onProgress({ kind: "InvokingChatCompletionsCreate", attempt: attempt });
        const reply = await this.config.mlcEngine.chat.completions.create(llmRequest);
        console.log("SLOP: mlc replied with choices");
        console.log(reply?.choices);
        choices = reply.choices;
      } catch (error) {
        console.error("SLOP: mlc chat completions create failed");
        console.error(error);
        throw error;
      }

      let toolCallDatas: { choice: ChatCompletion.Choice; json: string }[];
      switch (this.config.mlcModel) {
        case "Hermes-3-Llama-3.1-8B-q4f16_1-MLC": {
          toolCallDatas = choices
            .filter((c) => c.finish_reason === "stop" && c.message?.content?.startsWith("<function>") && c.message?.content?.endsWith("</function>"))
            .map((c) => ({
              choice: c,
              json: c.message?.content?.replace("<function>", "")?.replace("</function>", "")!,
            }))
            .filter((x) => !!x.json);

          break;
        }
        case "Llama-3.2-1B-Instruct-q4f32_1-MLC": {
          toolCallDatas = choices
            .filter((c) => c.finish_reason === "stop" && c.message?.content?.includes("```"))
            .map((c) => ({
              choice: c,
              json: c.message?.content
                ?.replace(new RegExp("```", "g"), "")
                ?.replace(new RegExp("\n", "g"), "")
                ?.replace(new RegExp("\r", "g"), "")
                ?.replace(new RegExp("python", "g"), "")!,
            }))
            .filter((x) => !!x.json);
        }
      }

      if (toolCallDatas.length === 0) {
        console.error("SLOP: no valid tool calls");
        if (attempt < maxAttempts) {
          continue;
        } else {
          return "No tool calls detected.";
        }
      }
      const toolCallData = toolCallDatas[0];

      let toolCall: { name: string; parameters: any };
      try {
        toolCall = JSON.parse(toolCallData.json);
      } catch (error) {
        console.error("SLOP: error parsing mlc tool call");
        if (attempt < maxAttempts) {
          continue;
        } else {
          return "No tool calls detected.";
        }
      }

      followupMessages.push(toolCallData.choice.message);

      if (!toolCall.name) {
        console.error("SLOP: mlc no tool name");
        if (attempt < maxAttempts) {
          followupMessages.push({
            role: "user",
            content: "No tool name specified.",
          } as ChatCompletionUserMessageParam);
          continue;
        } else {
          return "No tool calls detected.";
        }
      }

      try {
        const trueOrFeedback = this.#slopTool.applyTrueOrFeedback(toolCall.name, toolCall.parameters);
        if (trueOrFeedback === true) {
          return true;
        }

        console.error("SLOP: mlc tool call feedback");
        if (attempt < maxAttempts) {
          console.error(`SLOP: mlc feedback: ${trueOrFeedback}`);
          followupMessages.push({
            role: "user",
            content: `Very good! Can you do this one more fix to it: ${trueOrFeedback}`,
          } as ChatCompletionUserMessageParam);
          continue;
        } else {
          return "Tool call failed.";
        }
      } catch (error) {
        console.error("SLOP: mlc tool call failed");
        console.error(error);
        if (attempt < maxAttempts) {
          followupMessages.push({
            role: "user",
            content: `Tool call failed: ${error}`,
          } as ChatCompletionUserMessageParam);
          continue;
        } else {
          return "Tool call failed.";
        }
      }
    }
  }
}

function createSystemPrompt(template: string) {
  if (template.includes("{{TOOL_SCHEMAS}}")) {
    template = template.replace("{{TOOL_SCHEMAS}}", SlopTool.SCHEMAS);
  }
  return template;
}

const HERMES_3_LLAMA_3_1_8B_Q4F16_1_MLC_SYSTEMPROMPTTEMPLATE = `Cutting Knowledge Date: December 2023
Today Date: 03 June 2025
# Tool Instructions
You have access to the following functions:
{{TOOL_SCHEMAS}}
If a you choose to call a function ONLY reply in the following format:
    <function>{"name": function name, "parameters": dictionary of argument name and its value}</function>
Here is an example,
    <function>{"name": "example_function_name", "parameters": {"example_name": "example_value"}}</function>
Reminder:
- Function calls MUST follow the specified format and use BOTH <function> and </function>
- Required parameters MUST be specified
- Only call one function at a time
- When calling a function, do NOT add any other words, ONLY the function calling
- Put the entire function call reply on one line
- Always add your sources when using search results to answer the user query
You are a helpful Assistant.`;

const LLAMA_3_2_1B_INSTRUCT_Q4F32_1_MLC_SYSTEMPROMPTTEMPLATE = `Cutting Knowledge Date: December 2023
Today Date: 03 June 2025
# Tool Instructions
You have access to the following functions:
{{TOOL_SCHEMAS}}
If a you choose to call a function ONLY reply in the following format:
    \`\`\`{"name": function name, "parameters": dictionary of argument name and its value}\`\`\`
Here is an example,
    \`\`\`{"name": "example_function_name", "parameters": {"example_name": "example_value"}}\`\`\`
Reminder:
- Function calls MUST follow the specified format and use \`\`\`
- Required parameters MUST be specified
- Only call one function at a time
- When calling a function, do NOT add any other words, ONLY the function calling
- Put the entire function call reply on one line
- Always add your sources when using search results to answer the user query
You are a helpful Assistant.`;

import { ChatOpenAI } from "@langchain/openai";
import { env } from "@/lib/env";
import { runtimeDebug } from "@/lib/runtimeLogger";

export interface ModelOptions {
  temperature?: number;
  useSlm?: boolean;
}

function getBaseModel(provider: string, modelName: string, temperature: number): ChatOpenAI {
  const normProvider = provider.toLowerCase();
  const timeout = 45_000;
  const maxRetries = normProvider === "groq" ? 2 : 6;

  if (normProvider === "groq" && env.GROQ_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.GROQ_API_KEY,
      modelName,
      temperature,
      maxTokens: 2048,
      timeout,
      maxRetries,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
    });
  }

  if (normProvider === "openrouter" && env.OPENROUTER_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      modelName,
      temperature,
      maxTokens: 2048,
      timeout,
      maxRetries,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });
  }

  if ((normProvider === "gemini" || normProvider === "google") && env.GEMINI_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.GEMINI_API_KEY,
      modelName,
      temperature,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
    });
  }

  if (normProvider === "openai" && env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.OPENAI_API_KEY,
      modelName,
      temperature,
      maxTokens: 2048,
      timeout,
      maxRetries,
    });
  }

  // Generic fallback if not fully matched but key exists
  if (env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.OPENAI_API_KEY,
      modelName: "gpt-4o-mini",
      temperature,
      maxTokens: 2048,
      timeout,
      maxRetries,
    });
  }

  if (env.GROQ_API_KEY) {
    return new ChatOpenAI({
      apiKey: env.GROQ_API_KEY,
      modelName: "llama-3.1-8b-instant",
      temperature,
      maxTokens: 2048,
      timeout,
      maxRetries: 2,
      configuration: {
        baseURL: "https://api.groq.com/openai/v1",
      },
    });
  }

  throw new Error(`Model provider ${provider} could not be instantiated: missing API keys.`);
}

function logFallbackTelemetry(data: {
  primaryModel: string;
  fallbackModel: string;
  reason: string;
  errorType: string;
  latency: number;
  testCaseId: string | null;
}) {
  runtimeDebug(`[Groq Fallback Log] FALLBACK_EVENT:`, JSON.stringify(data, null, 2));
}

export function getLangChainModel(options: ModelOptions = {}) {
  const provider = options.useSlm
    ? (env.SLM_PROVIDER || "groq").toLowerCase()
    : (env.LLM_PROVIDER || "groq").toLowerCase();

  const modelName = options.useSlm
    ? (env.SLM_MODEL || "llama-3.1-8b-instant")
    : (env.LLM_MODEL || "llama-3.1-8b-instant");

  const temperature = options.temperature ?? (options.useSlm ? 0.1 : 0.3);

  const primaryModel = getBaseModel(provider, modelName, temperature);
  const originalInvoke = primaryModel.invoke.bind(primaryModel);

  primaryModel.invoke = async function (input, config) {
    try {
      return await originalInvoke(input, config);
    } catch (error: any) {
      const errorType = error.constructor?.name || "Error";
      const errorMsg = error.message || String(error);
      console.warn(`[Model Telemetry] Primary model ${modelName} failed with ${errorType}: ${errorMsg}`);

      if (provider === "groq" && env.GROQ_API_KEY) {
        const groqModels = [
          "llama-3.1-8b-instant",
          "llama-3.3-70b-versatile",
          "meta-llama/llama-4-scout-17b-16e-instruct",
          "openai/gpt-oss-20b"
        ];
        for (const fallbackModel of groqModels) {
          if (fallbackModel === modelName) continue;
          const fallbackStartTime = Date.now();
          try {
            runtimeDebug(`[Model Telemetry] Trying Groq fallback model: ${fallbackModel}`);
            const fallbackModelInstance = getBaseModel("groq", fallbackModel, temperature);
            const res = await fallbackModelInstance.invoke(input, config);

            logFallbackTelemetry({
              primaryModel: modelName,
              fallbackModel,
              reason: errorMsg,
              errorType,
              latency: Date.now() - fallbackStartTime,
              testCaseId: process.env.QA_TEST_CASE_ID || null
            });
            return res;
          } catch (fallbackError: any) {
            console.warn(`[Model Telemetry] Fallback model ${fallbackModel} failed: ${fallbackError.message || fallbackError}`);
          }
        }
      }
      throw error;
    }
  };

  return primaryModel;
}

export function getLangChainStructuredModel(schema: any, options: ModelOptions = {}) {
  const provider = options.useSlm
    ? (env.SLM_PROVIDER || "groq").toLowerCase()
    : (env.LLM_PROVIDER || "groq").toLowerCase();

  const modelName = options.useSlm
    ? (env.SLM_MODEL || "llama-3.1-8b-instant")
    : (env.LLM_MODEL || "llama-3.1-8b-instant");

  const temperature = options.temperature ?? (options.useSlm ? 0.1 : 0.3);

  const primaryModel = getBaseModel(provider, modelName, temperature);
  const primaryStructured = primaryModel.withStructuredOutput(schema, {
    method: "jsonMode"
  });

  const originalInvoke = primaryStructured.invoke.bind(primaryStructured);

  primaryStructured.invoke = async function (input, config) {
    try {
      return await originalInvoke(input, config);
    } catch (error: any) {
      const errorType = error.constructor?.name || "Error";
      const errorMsg = error.message || String(error);
      console.warn(`[Model Telemetry] Primary structured model ${modelName} failed with ${errorType}: ${errorMsg}`);

      if (provider === "groq" && env.GROQ_API_KEY) {
        const groqModels = [
          "llama-3.1-8b-instant",
          "llama-3.3-70b-versatile",
          "meta-llama/llama-4-scout-17b-16e-instruct",
          "openai/gpt-oss-20b"
        ];
        for (const fallbackModel of groqModels) {
          if (fallbackModel === modelName) continue;
          const fallbackStartTime = Date.now();
          try {
            runtimeDebug(`[Model Telemetry] Trying Groq fallback structured model: ${fallbackModel}`);
            const fallbackModelInstance = getBaseModel("groq", fallbackModel, temperature);
            const fallbackStructured = fallbackModelInstance.withStructuredOutput(schema, {
              method: "jsonMode"
            });
            const res = await fallbackStructured.invoke(input, config);

            logFallbackTelemetry({
              primaryModel: modelName,
              fallbackModel,
              reason: errorMsg,
              errorType,
              latency: Date.now() - fallbackStartTime,
              testCaseId: process.env.QA_TEST_CASE_ID || null
            });
            return res;
          } catch (fallbackError: any) {
            console.warn(`[Model Telemetry] Fallback structured model ${fallbackModel} failed: ${fallbackError.message || fallbackError}`);
          }
        }
      }
      throw error;
    }
  };

  return primaryStructured;
}

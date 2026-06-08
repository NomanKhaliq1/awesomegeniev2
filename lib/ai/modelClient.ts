import { env } from "@/lib/env";
import { logAiUsage } from "@/lib/data/aiUsageRepository";
import { startLangSmithRun } from "@/lib/langsmith/tracing";

type GenerateTextInput = {
  provider?: string;
  model?: string;
  system: string;
  user: string;
  temperature?: number;
  task?: string;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateWithSlm(input: Omit<GenerateTextInput, "provider" | "model">) {
  return generateText({
    ...input,
    provider: env.SLM_PROVIDER,
    model: env.SLM_MODEL,
    temperature: input.temperature ?? 0.1,
    task: input.task ?? "slm"
  });
}

export async function generateWithLlm(input: Omit<GenerateTextInput, "provider" | "model">) {
  return generateText({
    ...input,
    provider: env.LLM_PROVIDER,
    model: env.LLM_MODEL,
    temperature: input.temperature ?? 0.3,
    task: input.task ?? "llm"
  });
}

async function generateText({
  provider,
  model,
  system,
  user,
  temperature = 0.2,
  task = "unknown"
}: GenerateTextInput) {
  if (!provider || !model) {
    throw new Error("Model provider or model is not configured.");
  }

  const normalizedProvider = provider.toLowerCase();
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: system
    },
    {
      role: "user",
      content: user
    }
  ];
  const trace = await startLangSmithRun({
    name: task,
    runType: "llm",
    inputs: {
      provider: normalizedProvider,
      model,
      temperature,
      messages
    },
    metadata: {
      provider: normalizedProvider,
      model,
      task
    }
  });

  try {
    let content: string;

    if (normalizedProvider === "groq") {
      content = await generateOpenAiCompatible({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: env.GROQ_API_KEY,
        model,
        messages,
        temperature,
        provider: normalizedProvider,
        task
      });
    } else if (normalizedProvider === "openrouter") {
      content = await generateOpenAiCompatible({
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: env.OPENROUTER_API_KEY,
        model,
        messages,
        temperature,
        provider: normalizedProvider,
        task
      });
    } else if (normalizedProvider === "gemini" || normalizedProvider === "google") {
      content = await generateGemini({
        model,
        system,
        user,
        temperature,
        provider: normalizedProvider,
        task
      });
    } else {
      throw new Error(`Unsupported model provider: ${provider}`);
    }

    await trace?.end({
      outputs: {
        content
      }
    });

    return content;
  } catch (error) {
    await trace?.end({
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

type OpenAiCompatibleInput = {
  url: string;
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  provider: string;
  task: string;
};

async function generateOpenAiCompatible({
  url,
  apiKey,
  model,
  messages,
  temperature,
  provider,
  task
}: OpenAiCompatibleInput) {
  if (!apiKey) {
    throw new Error("API key is not configured.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    })
  });

  if (!response.ok) {
    const body = await response.text();
    await logAiUsage({
      provider,
      model,
      task,
      status: "failed",
      errorMessage: `Model request failed: ${response.status}`
    });
    throw new Error(`Model request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    await logAiUsage({
      provider,
      model,
      task,
      status: "failed",
      errorMessage: "Model response did not include content."
    });
    throw new Error("Model response did not include content.");
  }

  await logAiUsage({
    provider,
    model,
    task,
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    totalTokens: data.usage?.total_tokens ?? null,
    status: "success"
  });

  return content;
}

type GeminiInput = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  provider: string;
  task: string;
};

async function generateGemini({ model, system, user, temperature, provider, task }: GeminiInput) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: system }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }]
          }
        ],
        generationConfig: {
          temperature
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    await logAiUsage({
      provider,
      model,
      task,
      status: "failed",
      errorMessage: `Gemini request failed: ${response.status}`
    });
    throw new Error(`Gemini request failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    await logAiUsage({
      provider,
      model,
      task,
      status: "failed",
      errorMessage: "Gemini response did not include content."
    });
    throw new Error("Gemini response did not include content.");
  }

  await logAiUsage({
    provider,
    model,
    task,
    status: "success"
  });

  return content;
}

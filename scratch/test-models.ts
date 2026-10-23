import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";

async function testModel(modelName: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("No OPENROUTER_API_KEY found.");
    return;
  }

  console.log(`Initializing ChatOpenAI for OpenRouter with model: ${modelName}...`);
  const model = new ChatOpenAI({
    apiKey,
    modelName,
    temperature: 0.1,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1"
    }
  });

  try {
    const response = await model.invoke("Say hello in English.");
    console.log(`[${modelName}] Response:`, response.content);
  } catch (err: any) {
    console.error(`[${modelName}] Error:`, err.message);
  }
}

async function run() {
  await testModel("meta-llama/llama-3.1-70b-instruct");
  await testModel("google/gemini-2.5-flash");
}

run().catch(console.error);

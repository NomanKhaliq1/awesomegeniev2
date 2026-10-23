import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("No OPENROUTER_API_KEY found.");
    return;
  }

  console.log("Initializing ChatOpenAI for OpenRouter...");
  const model = new ChatOpenAI({
    apiKey,
    modelName: "meta-llama/llama-3.1-8b-instruct", // typical cheap/standard model
    temperature: 0.1,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1"
    }
  });

  console.log("Invoking OpenRouter model...");
  const response = await model.invoke("Say hello in English.");
  console.log("Response:", response.content);
}

testOpenRouter().catch(console.error);

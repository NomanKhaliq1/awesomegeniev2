import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";

async function testOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("No OPENAI_API_KEY found.");
    return;
  }

  console.log("Initializing ChatOpenAI...");
  const model = new ChatOpenAI({
    apiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.1
  });

  console.log("Invoking ChatOpenAI model...");
  const response = await model.invoke("Say hello in English.");
  console.log("Response:", response.content);
}

testOpenAi().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function checkModelConfig() {
  const { getLangChainModel } = await import("../lib/langchain/model");
  const model = getLangChainModel();
  console.log("Model initialized:", model);
  // Let's call a simple prompt to make sure it runs through openrouter
  console.log("Invoking simple prompt...");
  const response = await model.invoke("Say hello");
  console.log("Response:", response.content);
}

checkModelConfig().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";

async function testGroqModel(modelName: string) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = new ChatOpenAI({
    apiKey,
    modelName,
    temperature: 0.1,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1"
    }
  });
  try {
    const res = await model.invoke("Say hello.");
    console.log(`Groq [${modelName}] success:`, res.content);
    return true;
  } catch (err: any) {
    console.error(`Groq [${modelName}] error:`, err.message);
    return false;
  }
}

async function run() {
  await testGroqModel("llama-3.3-70b-specdec");
  await testGroqModel("llama-3.1-70b-versatile");
  await testGroqModel("llama-3.1-8b-instant");
  await testGroqModel("llama3-70b-8192");
  await testGroqModel("llama3-8b-8292");
}

run().catch(console.error);

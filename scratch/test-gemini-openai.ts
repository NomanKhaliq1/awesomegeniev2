import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";

async function testGeminiOpenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY");
    return;
  }
  console.log("Testing Gemini via OpenAI compatibility endpoint...");
  const model = new ChatOpenAI({
    apiKey,
    modelName: "gemini-2.5-flash",
    temperature: 0.1,
    configuration: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai"
    }
  });
  try {
    const res = await model.invoke("Say hello.");
    console.log("Gemini OpenAI success:", res.content);
  } catch (err: any) {
    console.error("Gemini OpenAI error:", err.message);
  }
}

testGeminiOpenAI().catch(console.error);

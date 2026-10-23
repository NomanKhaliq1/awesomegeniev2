import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

async function testGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log("No GROQ_API_KEY");
    return;
  }
  console.log("Testing Groq...");
  const model = new ChatOpenAI({
    apiKey,
    modelName: "llama-3.1-8b-instant",
    temperature: 0.1,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1"
    }
  });
  try {
    const res = await model.invoke("Say hello.");
    console.log("Groq success:", res.content);
  } catch (err: any) {
    console.error("Groq error:", err.message);
  }
}

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("No OPENAI_API_KEY");
    return;
  }
  console.log("Testing OpenAI...");
  const model = new ChatOpenAI({
    apiKey,
    modelName: "gpt-4o-mini",
    temperature: 0.1
  });
  try {
    const res = await model.invoke("Say hello.");
    console.log("OpenAI success:", res.content);
  } catch (err: any) {
    console.error("OpenAI error:", err.message);
  }
}

async function testGeminiDirect() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY");
    return;
  }
  console.log("Testing Gemini API directly via fetch...");
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Say hello." }] }]
        })
      }
    );
    if (!response.ok) {
      console.error("Gemini error status:", response.status, await response.text());
    } else {
      const data = await response.json();
      console.log("Gemini direct success:", JSON.stringify(data));
    }
  } catch (err: any) {
    console.error("Gemini direct error:", err.message);
  }
}

async function run() {
  await testGroq();
  await testOpenAI();
  await testGeminiDirect();
}

run().catch(console.error);

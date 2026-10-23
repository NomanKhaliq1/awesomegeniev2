import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testGemini(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Say hello." }] }]
        })
      }
    );
    if (!response.ok) {
      console.log(`[${modelName}] Fail status:`, response.status, await response.text());
    } else {
      const data = await response.json();
      console.log(`[${modelName}] Success:`, JSON.stringify(data));
    }
  } catch (err: any) {
    console.error(`[${modelName}] Error:`, err.message);
  }
}

async function run() {
  await testGemini("gemini-1.5-flash");
  await testGemini("gemini-1.5-pro");
  await testGemini("gemini-2.5-flash");
  await testGemini("gemini-2.5-pro");
  await testGemini("gemini-1.5-flash-latest");
  await testGemini("gemini-1.5-pro-latest");
}

run().catch(console.error);

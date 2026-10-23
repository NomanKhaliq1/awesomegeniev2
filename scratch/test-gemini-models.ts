import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No GEMINI_API_KEY found");
    return;
  }
  console.log("Listing Gemini models...");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Error listing models:", err.message);
  }
}

run().catch(console.error);

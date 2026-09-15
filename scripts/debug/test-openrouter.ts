import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("No OPENROUTER_API_KEY found.");
    return;
  }

  console.log("Testing OpenRouter API connection...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-8b-instruct:free",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello!" }
      ],
      temperature: 0.1
    })
  });

  if (response.ok) {
    const data = await response.json() as any;
    console.log("OpenRouter Test Success! Response:", JSON.stringify(data, null, 2));
  } else {
    console.error("OpenRouter Test Failed:", response.status, await response.text());
  }
}

main().catch(console.error);

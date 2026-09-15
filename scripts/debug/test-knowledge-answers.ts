import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { answerWithWebsiteRag } = await import("@/lib/langchain/ragAnswer");
  
  const sessionId = "eebf2895-58f8-46a7-88e9-37f070cc53c2"; // Latest session ID from task-193
  const question = "I just uploaded our requirements document. Tell me, what is the tech support email and project budget listed in it?";

  console.log("Calling answerWithWebsiteRag...");
  const result = await answerWithWebsiteRag({
    sessionId,
    question
  });

  console.log("Website RAG Answer Output:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

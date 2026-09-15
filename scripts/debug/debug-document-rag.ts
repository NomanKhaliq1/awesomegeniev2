import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  // Dynamically import project modules after loading environment variables
  const { getSystemSetting } = await import("@/lib/data/settingsRepository");
  const { retrieveDocumentChunksFromPinecone } = await import("@/lib/langchain/retrieveDocumentChunksFromPinecone");
  const { getSessionDocumentNamespace } = await import("@/lib/langchain/ingestDocumentToPinecone");

  const sessionId = "0a2b1977-a67e-4675-ada4-e6fd050c380a"; // Latest session ID
  const question = "I just uploaded our requirements document. Tell me, what is the tech support email and project budget listed in it?";

  const minScore = await getSystemSetting<number>("document_rag_min_match_score", 0);
  const namespace = await getSessionDocumentNamespace(sessionId);
  const chunks = await retrieveDocumentChunksFromPinecone(sessionId, question, 5);

  console.log(`Session ID: ${sessionId}`);
  console.log(`Namespace: ${namespace}`);
  console.log(`Min Match Score Threshold: ${minScore}`);
  console.log(`Retrieved Chunks Count: ${chunks.length}`);
  
  for (const chunk of chunks) {
    console.log(`- Score: ${chunk.score}`);
    console.log(`  Content: "${chunk.text.slice(0, 200)}..."`);
  }
}

main().catch(console.error);

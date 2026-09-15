import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { ingestWebsiteChunksToPinecone } = await import(
    "@/lib/langchain/ingestWebsiteChunksToPinecone"
  );
  const result = await ingestWebsiteChunksToPinecone();

  console.log("rag:ingest complete");
  console.log(`Sections found: ${result.sectionsFound}`);
  console.log(`Chunks created: ${result.chunksCreated}`);
  console.log(`Vectors upserted: ${result.vectorsUpserted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};

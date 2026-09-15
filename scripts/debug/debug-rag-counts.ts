import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { listApprovedWebsiteSectionsForRag } = await import("@/lib/data/ragRepository");
  const { chunkWebsiteSections } = await import("@/lib/langchain/chunkWebsiteSections");
  const sections = await listApprovedWebsiteSectionsForRag();
  const chunks = await chunkWebsiteSections(sections);

  console.log(
    JSON.stringify(
      {
        sections: sections.length,
        firstSectionLength: sections[0]?.content?.length ?? 0,
        firstSourceUrl: sections[0]?.website_json_sources?.url ?? null,
        chunks: chunks.length,
        firstChunkLength: chunks[0]?.content?.length ?? 0,
        firstChunkId: chunks[0]?.id ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

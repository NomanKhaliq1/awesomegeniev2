import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createOptionalSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { chunkWebsiteSections } = await import("../lib/langchain/chunkWebsiteSections");
  const { embedTexts } = await import("../lib/langchain/embeddingProvider");
  const { getPineconeIndex, getWebsiteNamespace } = await import("../lib/langchain/pineconeClient");
  const { upsertRagChunks, markWebsiteSectionsSynced } = await import("../lib/data/ragRepository");

  const url = "https://www.awesometech.com/encompass-plugins";
  const { data: existingSource, error: findError } = await supabase
    .from("website_json_sources")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (findError || !existingSource) {
    throw findError || new Error(`No website source found for URL: ${url}`);
  }

  const sourceId = existingSource.id;
  console.log("Found source ID dynamically:", sourceId);

  const { data: sections, error } = await supabase
    .from("website_sections")
    .select("id, source_id, heading, content, sort_order, website_json_sources!inner(url, title)")
    .eq("source_id", sourceId);

  if (error || !sections || sections.length === 0) {
    throw error || new Error(`No sections found for source ${sourceId}`);
  }

  console.log(`Found ${sections.length} sections. Chunking...`);
  // Format sections to match WebsiteSectionForRag
  const formattedSections = sections.map(s => {
    const rawSource = s.website_json_sources as any;
    const sourceObj = Array.isArray(rawSource) ? rawSource[0] : rawSource;
    return {
      id: s.id,
      source_id: s.source_id,
      heading: s.heading,
      content: s.content,
      sort_order: s.sort_order,
      website_json_sources: {
        url: sourceObj?.url || "",
        title: sourceObj?.title || ""
      }
    };
  });

  const chunks = await chunkWebsiteSections(formattedSections);

  if (chunks.length === 0) {
    console.log("No chunks created.");
    return;
  }

  console.log(`Created ${chunks.length} chunks. Embedding...`);
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  console.log("Embedding complete. Upserting to Pinecone...");
  const namespace = getWebsiteNamespace();
  const pineconeNamespace = getPineconeIndex().namespace(namespace);
  
  const records = chunks.map((chunk, index) => {
    const meta = chunk.metadata as any;
    return {
      id: chunk.id,
      values: embeddings[index],
      metadata: {
        url: meta.sourceUrl || "",
        title: meta.sourceTitle || "",
        heading: meta.heading || "",
        text: chunk.content
      }
    };
  });

  await pineconeNamespace.upsert({
    records
  });

  console.log("Upserted to Pinecone successfully. Syncing to DB rag_chunks...");
  await upsertRagChunks(
    chunks.map((chunk) => ({
      sourceType: "website",
      sourceId: chunk.sourceId,
      sectionId: chunk.sectionId,
      chunkIndex: chunk.chunkIndex,
      pineconeVectorId: chunk.id,
      pineconeNamespace: namespace,
      content: chunk.content,
      metadata: chunk.metadata
    }))
  );

  await markWebsiteSectionsSynced(Array.from(new Set(chunks.map((chunk) => chunk.sectionId))));
  console.log("Seeding and Pinecone ingestion completed successfully!");
}

main().catch(console.error);

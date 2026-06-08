import {
  listApprovedWebsiteSectionsForRag,
  markWebsiteSectionsSynced,
  upsertRagChunks
} from "@/lib/data/ragRepository";
import { embedTexts } from "./embeddingProvider";
import { chunkWebsiteSections } from "./chunkWebsiteSections";
import { getPineconeIndex, getWebsiteNamespace } from "./pineconeClient";

export type WebsiteIngestResult = {
  sectionsFound: number;
  chunksCreated: number;
  vectorsUpserted: number;
};

export async function ingestWebsiteChunksToPinecone(): Promise<WebsiteIngestResult> {
  const sections = await listApprovedWebsiteSectionsForRag();

  if (sections.length === 0) {
    return {
      sectionsFound: 0,
      chunksCreated: 0,
      vectorsUpserted: 0
    };
  }

  const chunks = await chunkWebsiteSections(sections);

  if (chunks.length === 0) {
    return {
      sectionsFound: sections.length,
      chunksCreated: 0,
      vectorsUpserted: 0
    };
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
  const namespace = getWebsiteNamespace();
const pineconeNamespace = getPineconeIndex().namespace(namespace);
  const records = chunks.map((chunk, index) => ({
      id: chunk.id,
      values: embeddings[index],
      metadata: removeNullishMetadata({
        ...chunk.metadata,
        text: chunk.content
      })
    }));

  for (const recordBatch of chunkArray(records, 100)) {
    await pineconeNamespace.upsert({
      records: recordBatch
    });
  }

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

  return {
    sectionsFound: sections.length,
    chunksCreated: chunks.length,
    vectorsUpserted: chunks.length
  };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function removeNullishMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== null && value !== undefined)
  ) as Record<string, string | number | boolean | string[]>;
}

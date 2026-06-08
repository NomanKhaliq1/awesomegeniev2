import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export type WebsiteSectionForRag = {
  id: string;
  source_id: string;
  heading: string | null;
  content: string;
  sort_order: number;
  website_json_sources: {
    url: string;
    title: string | null;
  };
};

export type RagChunkInput = {
  sourceType: "website" | "uploaded_file";
  sourceId: string;
  sectionId?: string | null;
  chunkIndex: number;
  pineconeVectorId: string;
  pineconeNamespace: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export async function listApprovedWebsiteSectionsForRag() {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const pageSize = 1000;
  const sections: WebsiteSectionForRag[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("website_sections")
      .select(
        "id, source_id, heading, content, sort_order, website_json_sources!inner(url, title, approved_for_rag, needs_review)"
      )
      .eq("website_json_sources.approved_for_rag", true)
      .eq("website_json_sources.needs_review", false)
      .order("sort_order", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Supabase listApprovedWebsiteSectionsForRag failed:", error.message);
      return sections;
    }

    const page = (data ?? []) as unknown as WebsiteSectionForRag[];
    sections.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return sections;
}

export async function upsertRagChunks(chunks: RagChunkInput[]) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase || chunks.length === 0) {
    return;
  }

  for (const batch of chunkArray(chunks, 500)) {
    const { error } = await supabase.from("rag_chunks").upsert(
      batch.map((chunk) => ({
        source_type: chunk.sourceType,
        source_id: chunk.sourceId,
        section_id: chunk.sectionId ?? null,
        chunk_index: chunk.chunkIndex,
        pinecone_vector_id: chunk.pineconeVectorId,
        pinecone_namespace: chunk.pineconeNamespace,
        content: chunk.content,
        metadata: chunk.metadata ?? {}
      })),
      {
        onConflict: "pinecone_vector_id"
      }
    );

    if (error) {
      throw new Error(`Supabase upsertRagChunks failed: ${error.message}`);
    }
  }
}

export async function markWebsiteSectionsSynced(sectionIds: string[]) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase || sectionIds.length === 0) {
    return;
  }

  for (const batch of chunkArray(sectionIds, 500)) {
    const { error } = await supabase
      .from("website_sections")
      .update({
        pinecone_synced: true
      })
      .in("id", batch);

    if (error) {
      throw new Error(`Supabase markWebsiteSectionsSynced failed: ${error.message}`);
    }
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

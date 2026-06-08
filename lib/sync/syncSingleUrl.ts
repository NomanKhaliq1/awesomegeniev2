import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import { deleteWebsiteVectorsForSource } from "@/lib/langchain/deleteWebsiteVectors";
import { extractRenderedContent } from "./extractRenderedContent";
import { renderWithPlaywright } from "./renderWithPlaywright";

type SyncSingleUrlInput = {
  url: string;
  lastmod?: string | null;
  approvedForRag?: boolean;
};

export async function syncSingleUrl({
  url,
  lastmod = null,
  approvedForRag = true
}: SyncSingleUrlInput) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const html = await renderWithPlaywright(url);
  const extracted = extractRenderedContent(html);

  if (extracted.sections.length === 0) {
    return {
      url,
      sourceId: null,
      sections: 0,
      skipped: true
    };
  }

  const { data: existingSource, error: existingSourceError } = await supabase
    .from("website_json_sources")
    .select("id, content_hash")
    .eq("url", url)
    .maybeSingle<{ id: string; content_hash: string | null }>();

  if (existingSourceError) {
    throw new Error(`Failed to read existing source ${url}: ${existingSourceError.message}`);
  }

  if (existingSource?.content_hash === extracted.contentHash) {
    return {
      url,
      sourceId: existingSource.id,
      sections: extracted.sections.length,
      skipped: true,
      reason: "unchanged"
    };
  }

  const { data: source, error: sourceError } = await supabase
    .from("website_json_sources")
    .upsert(
      {
        url,
        title: extracted.title,
        content_hash: extracted.contentHash,
        lastmod,
        approved_for_rag: approvedForRag,
        needs_review: false,
        pinecone_synced: false,
        raw_json: {
          syncedBy: "sync:website",
          sectionCount: extracted.sections.length
        }
      },
      {
        onConflict: "url"
      }
    )
    .select("id")
    .single<{ id: string }>();

  if (sourceError) {
    throw new Error(`Failed to upsert website source ${url}: ${sourceError.message}`);
  }

  await deleteWebsiteVectorsForSource(source.id);

  const { error: deleteError } = await supabase
    .from("website_sections")
    .delete()
    .eq("source_id", source.id);

  if (deleteError) {
    throw new Error(`Failed to clear existing sections for ${url}: ${deleteError.message}`);
  }

  const { error: sectionsError } = await supabase.from("website_sections").insert(
    extracted.sections.map((section) => ({
      source_id: source.id,
      heading: section.heading,
      content: section.content,
      sort_order: section.sortOrder,
      content_hash: section.contentHash,
      pinecone_synced: false
    }))
  );

  if (sectionsError) {
    throw new Error(`Failed to insert website sections for ${url}: ${sectionsError.message}`);
  }

  return {
    url,
    sourceId: source.id,
    sections: extracted.sections.length,
    skipped: false,
    reason: existingSource ? "changed" : "new"
  };
}

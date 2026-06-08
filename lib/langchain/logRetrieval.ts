import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import type { RetrievedWebsiteChunk } from "./retrieveWebsiteChunksFromPinecone";

export async function logRetrieval({
  sessionId,
  namespace,
  query,
  matches
}: {
  sessionId?: string | null;
  namespace: string;
  query: string;
  matches: RetrievedWebsiteChunk[];
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("rag_retrieval_logs").insert({
    session_id: sessionId ?? null,
    namespace,
    query,
    match_count: matches.length,
    matches: matches.map((match) => ({
      id: match.id,
      score: match.score,
      sourceUrl: match.sourceUrl,
      heading: match.heading
    }))
  });

  if (error) {
    console.error("Supabase logRetrieval failed:", error.message);
  }
}

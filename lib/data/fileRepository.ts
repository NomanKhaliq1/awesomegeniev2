import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export type UploadedFileRow = {
  id: string;
  client_id: string | null;
  session_id: string;
  storage_bucket: string;
  storage_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_kind: string;
  extracted_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DocumentSourceRow = {
  id: string;
  uploaded_file_id: string;
  client_id: string | null;
  session_id: string;
  title: string | null;
  extracted_text: string;
  content_hash: string | null;
  pinecone_namespace: string;
  pinecone_synced: boolean;
};

export async function ensureStorageBucket(bucket: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Supabase listBuckets failed: ${listError.message}`);
  }

  if (buckets?.some((candidate) => candidate.name === bucket)) {
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false
  });

  if (error) {
    throw new Error(`Supabase createBucket failed: ${error.message}`);
  }
}

export async function uploadFileToStorage({
  bucket,
  path,
  buffer,
  contentType
}: {
  bucket: string;
  path: string;
  buffer: Buffer;
  contentType: string;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false
  });

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`);
  }
}

export async function insertUploadedFile(input: {
  sessionId: string;
  storageBucket: string;
  storagePath: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  fileKind: string;
  extractedText: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("uploaded_files")
    .insert({
      session_id: input.sessionId,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      original_name: input.originalName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      file_kind: input.fileKind,
      extracted_text: input.extractedText,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single<UploadedFileRow>();

  if (error) {
    throw new Error(`Supabase insertUploadedFile failed: ${error.message}`);
  }

  return data;
}

export async function insertDocumentSource(input: {
  uploadedFileId: string;
  sessionId: string;
  title: string;
  extractedText: string;
  contentHash: string;
  pineconeNamespace: string;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("document_sources")
    .insert({
      uploaded_file_id: input.uploadedFileId,
      session_id: input.sessionId,
      title: input.title,
      extracted_text: input.extractedText,
      content_hash: input.contentHash,
      pinecone_namespace: input.pineconeNamespace,
      pinecone_synced: false
    })
    .select("*")
    .single<DocumentSourceRow>();

  if (error) {
    throw new Error(`Supabase insertDocumentSource failed: ${error.message}`);
  }

  return data;
}

export async function upsertDocumentChunks(
  chunks: Array<{
    documentSourceId: string;
    chunkIndex: number;
    pineconeVectorId: string;
    pineconeNamespace: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>
) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase || chunks.length === 0) {
    return;
  }

  const { error } = await supabase.from("document_chunks").upsert(
    chunks.map((chunk) => ({
      document_source_id: chunk.documentSourceId,
      chunk_index: chunk.chunkIndex,
      pinecone_vector_id: chunk.pineconeVectorId,
      pinecone_namespace: chunk.pineconeNamespace,
      content: chunk.content,
      metadata: chunk.metadata ?? {}
    })),
    {
      onConflict: "document_source_id,chunk_index"
    }
  );

  if (error) {
    throw new Error(`Supabase upsertDocumentChunks failed: ${error.message}`);
  }
}

export async function markDocumentSourceSynced(documentSourceId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("document_sources")
    .update({
      pinecone_synced: true
    })
    .eq("id", documentSourceId);

  if (error) {
    throw new Error(`Supabase markDocumentSourceSynced failed: ${error.message}`);
  }
}

export async function listUploadedFilesForSession(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<UploadedFileRow[]>();

  if (error) {
    console.error("Supabase listUploadedFilesForSession failed:", error.message);
    return [];
  }

  return data ?? [];
}

export async function listDocumentSourcesForSession(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("document_sources")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<DocumentSourceRow[]>();

  if (error) {
    console.error("Supabase listDocumentSourcesForSession failed:", error.message);
    return [];
  }

  return data ?? [];
}

export async function downloadStoredFile({
  bucket,
  path
}: {
  bucket: string;
  path: string;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new Error(`Supabase storage download failed: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

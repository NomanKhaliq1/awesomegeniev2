import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import {
  markDocumentSourceSynced,
  upsertDocumentChunks,
  type DocumentSourceRow
} from "@/lib/data/fileRepository";
import { embedTexts } from "./embeddingProvider";
import { getPineconeIndex } from "./pineconeClient";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 140
});

export async function getSessionDocumentNamespace(sessionId: string) {
  return `session-${sessionId}`;
}

export async function ingestDocumentToPinecone(documentSource: DocumentSourceRow) {
  const documents = await splitter.createDocuments([documentSource.extracted_text], [
    {
      sourceType: "uploaded_file",
      documentSourceId: documentSource.id,
      uploadedFileId: documentSource.uploaded_file_id,
      sessionId: documentSource.session_id,
      title: documentSource.title ?? "Uploaded document"
    }
  ]);

  if (documents.length === 0) {
    return {
      chunksCreated: 0,
      vectorsUpserted: 0
    };
  }

  const embeddings = await embedTexts(documents.map((document) => document.pageContent));
  const namespace = documentSource.pinecone_namespace;

  const records = documents.map((document, index) => {
    const vectorId = `document-${documentSource.id}-${index}`;

    return {
      id: vectorId,
      values: embeddings[index],
      metadata: {
        text: document.pageContent,
        sourceType: "uploaded_file",
        documentSourceId: documentSource.id,
        uploadedFileId: documentSource.uploaded_file_id,
        sessionId: documentSource.session_id,
        title: documentSource.title ?? "Uploaded document",
        chunkIndex: index
      }
    };
  });

  await getPineconeIndex().namespace(namespace).upsert({
    records
  });

  await upsertDocumentChunks(
    records.map((record, index) => ({
      documentSourceId: documentSource.id,
      chunkIndex: index,
      pineconeVectorId: record.id,
      pineconeNamespace: namespace,
      content: documents[index].pageContent,
      metadata: record.metadata
    }))
  );

  await markDocumentSourceSynced(documentSource.id);

  return {
    chunksCreated: records.length,
    vectorsUpserted: records.length
  };
}

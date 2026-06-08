import { embedText } from "./embeddingProvider";
import { getPineconeIndex } from "./pineconeClient";
import { getSessionDocumentNamespace } from "./ingestDocumentToPinecone";

export type RetrievedDocumentChunk = {
  id: string;
  score: number;
  text: string;
  title?: string;
  documentSourceId?: string;
};

export async function retrieveDocumentChunksFromPinecone(
  sessionId: string,
  query: string,
  topK = 5
): Promise<RetrievedDocumentChunk[]> {
  const queryEmbedding = await embedText(query);
  const response = await getPineconeIndex()
    .namespace(await getSessionDocumentNamespace(sessionId))
    .query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

  return (response.matches ?? []).map((match) => {
    const metadata = match.metadata ?? {};

    return {
      id: match.id,
      score: match.score ?? 0,
      text: typeof metadata.text === "string" ? metadata.text : "",
      title: typeof metadata.title === "string" ? metadata.title : undefined,
      documentSourceId:
        typeof metadata.documentSourceId === "string" ? metadata.documentSourceId : undefined
    };
  });
}

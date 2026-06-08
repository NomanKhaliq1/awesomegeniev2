import { embedText } from "./embeddingProvider";
import { getPineconeIndex, getWebsiteNamespace } from "./pineconeClient";

export type RetrievedWebsiteChunk = {
  id: string;
  score: number;
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
  heading?: string;
};

export async function retrieveWebsiteChunksFromPinecone(query: string, topK = 5) {
  const queryEmbedding = await embedText(query);
  const response = await getPineconeIndex().namespace(getWebsiteNamespace()).query({
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
      sourceUrl: typeof metadata.sourceUrl === "string" ? metadata.sourceUrl : undefined,
      sourceTitle: typeof metadata.sourceTitle === "string" ? metadata.sourceTitle : undefined,
      heading: typeof metadata.heading === "string" ? metadata.heading : undefined
    } satisfies RetrievedWebsiteChunk;
  });
}

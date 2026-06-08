import type { RetrievedWebsiteChunk } from "./retrieveWebsiteChunksFromPinecone";

export function buildRagContext(chunks: RetrievedWebsiteChunk[]) {
  return chunks
    .filter((chunk) => chunk.text.trim().length > 0)
    .map((chunk, index) => {
      const source = chunk.sourceUrl ? `Source: ${chunk.sourceUrl}` : "Source: website";
      return `[${index + 1}] ${source}\n${chunk.text}`;
    })
    .join("\n\n");
}

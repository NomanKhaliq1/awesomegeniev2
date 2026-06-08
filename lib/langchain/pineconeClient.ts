import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "@/lib/env";

let pineconeClient: Pinecone | null = null;

export function getPineconeClient() {
  if (!env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not configured.");
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: env.PINECONE_API_KEY
    });
  }

  return pineconeClient;
}

export function getPineconeIndex() {
  return getPineconeClient().index(env.PINECONE_INDEX_NAME);
}

export function getWebsiteNamespace() {
  return env.PINECONE_NAMESPACE_WEBSITE;
}

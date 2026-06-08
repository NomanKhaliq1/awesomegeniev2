import { getPineconeIndex, getWebsiteNamespace } from "./pineconeClient";

export async function deleteWebsiteVectorsForSource(sourceId: string) {
  await getPineconeIndex().namespace(getWebsiteNamespace()).deleteMany({
    filter: {
      sourceId: {
        $eq: sourceId
      }
    }
  });
}

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { WebsiteSectionForRag } from "@/lib/data/ragRepository";

export type WebsiteChunk = {
  id: string;
  sourceId: string;
  sectionId: string;
  chunkIndex: number;
  content: string;
  metadata: {
    sourceType: "website";
    sourceUrl: string;
    sourceTitle: string | null;
    heading: string | null;
    sectionId: string;
    sourceId: string;
    chunkIndex: number;
  };
};

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 140
});

export async function chunkWebsiteSections(sections: WebsiteSectionForRag[]) {
  const chunks: WebsiteChunk[] = [];

  for (const section of sections) {
    const sectionText = [section.heading, section.content].filter(Boolean).join("\n\n");
    const splitTexts = await splitter.splitText(sectionText);

    splitTexts.forEach((content, index) => {
      chunks.push({
        id: `website-${section.source_id}-${section.id}-${index}`,
        sourceId: section.source_id,
        sectionId: section.id,
        chunkIndex: index,
        content,
        metadata: {
          sourceType: "website",
          sourceUrl: section.website_json_sources.url,
          sourceTitle: section.website_json_sources.title,
          heading: section.heading,
          sectionId: section.id,
          sourceId: section.source_id,
          chunkIndex: index
        }
      });
    });
  }

  return chunks;
}

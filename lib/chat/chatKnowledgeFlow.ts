import { detectUserLanguage } from "@/lib/responses/languageDetection";

type WebsiteKnowledgeChunk = {
  id?: string;
  score?: number;
  heading?: string | null;
  content?: string | null;
  text?: string | null;
  sourceUrl?: string | null;
};

type DocumentKnowledgeChunk = {
  id?: string;
  score?: number;
  title?: string | null;
  content?: string | null;
  text?: string | null;
};

export function limitWordsToRange(text: string, minWords: number, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;

  let sentenceEnd = -1;
  for (let index = 0; index < words.length && index < maxWords; index++) {
    if (/[.?!]$/.test(words[index]) && index + 1 >= minWords) sentenceEnd = index;
  }

  return sentenceEnd >= 0
    ? words.slice(0, sentenceEnd + 1).join(" ")
    : `${words.slice(0, maxWords).join(" ")}...`;
}

export function appendSourceAttribution(
  response: string,
  userMessage: string,
  websiteChunks: WebsiteKnowledgeChunk[] = [],
  documentChunks: DocumentKnowledgeChunk[] = []
) {
  const normalizedMessage = userMessage.toLowerCase();
  const keywords = [
    "source", "sources", "reference", "references", "link", "links", "url", "urls",
    "website", "websites", "document", "documents", "pata", "patay", "zariya", "zariye",
    "suboot", "page", "pages", "address", "addresses", "where from", "kahan se", "kidhar",
    "documentation", "supporting material", "reference list", "supporting documents"
  ];
  if (!keywords.some((keyword) => normalizedMessage.includes(keyword))) return response;

  const documents = new Set<string>();
  const urls = new Set<string>();
  for (const chunk of documentChunks) {
    if ((chunk.score ?? 0) >= 0.35 && chunk.title && !response.includes(chunk.title)) {
      documents.add(chunk.title.trim());
    }
  }
  for (const chunk of websiteChunks) {
    if ((chunk.score ?? 0) >= 0.35 && chunk.sourceUrl && !response.toLowerCase().includes(chunk.sourceUrl.toLowerCase())) {
      urls.add(chunk.sourceUrl.trim());
    }
  }
  if (documents.size === 0 && urls.size === 0) return response;

  const prefix = detectUserLanguage(userMessage) === "roman_urdu"
    ? "Aap mazeed maloomat ke liye ye pages check kar sakte hain:"
    : "You can check these pages for more details:";
  const attribution = [...documents, ...urls].map((item) => `* ${item}`).join("\n");
  return `${response}\n\n${prefix}\n${attribution}`;
}

export function formatKnowledgeChunksForComposer({
  websiteChunks = [],
  documentChunks = []
}: {
  websiteChunks?: WebsiteKnowledgeChunk[];
  documentChunks?: DocumentKnowledgeChunk[];
}) {
  const websiteContext = websiteChunks.map((chunk, index) => [
    "Source: Website",
    `Heading: ${chunk.heading || `Website context ${index + 1}`}`,
    chunk.sourceUrl ? `URL: ${chunk.sourceUrl}` : "",
    typeof chunk.score === "number" ? `Match score: ${chunk.score}` : "",
    `Content: ${chunk.content || chunk.text || ""}`
  ].filter(Boolean).join("\n")).filter(Boolean).join("\n\n---\n\n");

  const documentContext = documentChunks.map((chunk, index) => [
    "Source: Uploaded document",
    `Title: ${chunk.title || `Document context ${index + 1}`}`,
    typeof chunk.score === "number" ? `Match score: ${chunk.score}` : "",
    `Content: ${chunk.content || chunk.text || ""}`
  ].filter(Boolean).join("\n")).filter(Boolean).join("\n\n---\n\n");

  return [websiteContext, documentContext].filter(Boolean).join("\n\n---\n\n");
}

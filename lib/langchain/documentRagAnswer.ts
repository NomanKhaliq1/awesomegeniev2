import { generateWithLlm } from "@/lib/ai/modelClient";
import { getPromptTemplate, getSystemSetting, renderTemplate } from "@/lib/data/settingsRepository";
import { retrieveDocumentChunksFromPinecone } from "./retrieveDocumentChunksFromPinecone";

export async function answerWithSessionDocuments({
  sessionId,
  question,
  minScore
}: {
  sessionId: string;
  question: string;
  minScore?: number;
}) {
  let chunks: any[] = [];
  try {
    chunks = await retrieveDocumentChunksFromPinecone(sessionId, question, 5);
  } catch (error) {
    console.error("[Pinecone Error] Failed to retrieve document chunks:", error);
    return {
      answer: null,
      chunks: []
    };
  }
  const resolvedMinScore =
    minScore ?? (await getSystemSetting<number>("document_rag_min_match_score"));
  const confidentChunks = chunks.filter((chunk) => chunk.score >= resolvedMinScore);
  const context = confidentChunks
    .map((chunk, index) => {
      return [
        `Document ${index + 1}`,
        chunk.title ? `Title: ${chunk.title}` : null,
        `Content: ${chunk.text}`
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");

  if (!context) {
    return {
      answer: null,
      chunks
    };
  }

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("document_rag.answer_system"),
    getPromptTemplate("document_rag.answer_user")
  ]);

  const answer = await generateWithLlm({
    system,
    user: renderTemplate(userTemplate, {
      context,
      question
    })
  });

  return {
    answer,
    chunks
  };
}

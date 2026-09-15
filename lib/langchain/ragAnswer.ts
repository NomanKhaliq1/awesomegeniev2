import { generateWithLlm } from "@/lib/ai/modelClient";
import { getPromptTemplate, getSystemSetting, renderTemplate } from "@/lib/data/settingsRepository";
import { buildRagContext } from "./buildRagContext";
import { retrieveWebsiteChunksFromPinecone } from "./retrieveWebsiteChunksFromPinecone";
import { getWebsiteNamespace } from "./pineconeClient";
import { logRetrieval } from "./logRetrieval";

export async function answerWithWebsiteRag({
  sessionId,
  question,
  minScore
}: {
  sessionId?: string | null;
  question: string;
  minScore?: number;
}) {
  let chunks: any[] = [];
  try {
    chunks = await retrieveWebsiteChunksFromPinecone(question, 5);
    await logRetrieval({
      sessionId,
      namespace: getWebsiteNamespace(),
      query: question,
      matches: chunks
    });
  } catch (error) {
    console.error("[Pinecone Error] Failed to retrieve website chunks:", error);
    return {
      answer: null,
      chunks: []
    };
  }

  const resolvedMinScore =
    minScore ?? (await getSystemSetting<number>("rag_min_match_score"));
  const confidentChunks = chunks.filter((chunk) => chunk.score >= resolvedMinScore);
  const context = buildRagContext(confidentChunks);

  if (!context) {
    return {
      answer: null,
      chunks
    };
  }

  let answer: string | null = null;

  try {
    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("rag.website_answer_system"),
      getPromptTemplate("rag.website_answer_user")
    ]);
    answer = await generateWithLlm({
      system,
      user: renderTemplate(userTemplate, {
        context,
        question
      })
    });
  } catch (error) {
    console.error("Website RAG answer generation failed:", error);
  }

  return {
    answer,
    chunks
  };
}

import { createChatSession, saveChatMessage } from "@/lib/data/chatRepository";
import { getPromptTemplate } from "@/lib/data/settingsRepository";
import { ensureClientRequirement } from "@/lib/data/requirementsRepository";
import { getDefaultMissingFields } from "@/lib/onboarding/defaultFields";

export type ChatSession = {
  id: string;
  startedAt: string;
  persisted: boolean;
  completionScore: number;
  missingFields: string[];
  status: string;
  openingMessage: string;
  firstQuestion: string;
};

export async function startSession(): Promise<ChatSession> {
  const [missingFields, openingMessage, firstQuestion] = await Promise.all([
    getDefaultMissingFields(),
    getPromptTemplate("chat.opening_message"),
    getPromptTemplate("chat.first_question")
  ]);
  const persistedSession = await createChatSession({
    completionScore: 0,
    missingFields
  });

  if (persistedSession) {
    await ensureClientRequirement({
      sessionId: persistedSession.id
    });

    await saveChatMessage({
      sessionId: persistedSession.id,
      role: "assistant",
      content: openingMessage,
      metadata: {
        kind: "opening_message"
      }
    });

    return {
      id: persistedSession.id,
      startedAt: persistedSession.started_at,
      persisted: true,
      completionScore: persistedSession.completion_score,
      missingFields: persistedSession.missing_fields,
      status: persistedSession.status,
      openingMessage,
      firstQuestion
    };
  }

  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    persisted: false,
    completionScore: 0,
    missingFields,
    status: "collecting_core",
    openingMessage,
    firstQuestion
  };
}

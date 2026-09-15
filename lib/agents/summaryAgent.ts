import {
  getLatestConversationSummary,
  listChatMessages,
  saveConversationSummary
} from "@/lib/data/chatRepository";
import { generateWithSlm } from "@/lib/ai/modelClient";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";

const summaryEveryMessages = 6;
const recentWindowMessages = 12;

export async function maybeSummarizeConversation(sessionId: string) {
  const messages = await listChatMessages(sessionId);

  const conversationMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant"
  );

  if (conversationMessages.length < summaryEveryMessages) {
    return null;
  }

  const latestSummary = await getLatestConversationSummary(sessionId);

  if (
    latestSummary &&
    conversationMessages.length - latestSummary.message_count < summaryEveryMessages
  ) {
    return latestSummary;
  }

  const unsummarizedMessages = conversationMessages
    .slice(latestSummary?.message_count ?? 0)
    .slice(-recentWindowMessages);
  const recentConversation = unsummarizedMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const summary = await generateRollingSummary({
    previousSummary: latestSummary?.summary ?? "",
    recentConversation
  });

  return saveConversationSummary({
    sessionId,
    summary,
    messageCount: conversationMessages.length
  });
}

async function generateRollingSummary({
  previousSummary,
  recentConversation
}: {
  previousSummary: string;
  recentConversation: string;
}) {
  try {
    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("summary.rollup_system"),
      getPromptTemplate("summary.rollup_user")
    ]);

    return generateWithSlm({
      task: "conversation.summary_rollup",
      system,
      user: renderTemplate(userTemplate, {
        previousSummary: previousSummary || "No previous summary.",
        recentConversation
      })
    });
  } catch (error) {
    console.error("Conversation summary rollup failed, using deterministic fallback:", error);

    return [previousSummary, recentConversation]
      .filter(Boolean)
      .join("\n")
      .slice(-3500);
  }
}

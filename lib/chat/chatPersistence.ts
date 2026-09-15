import {
  getLatestConversationSummary,
  listChatMessages
} from "@/lib/data/chatRepository";
import { maybeSummarizeConversation } from "@/lib/agents/summaryAgent";

export async function loadConversationContext(sessionId: string) {
  const [messages, latestSummary] = await Promise.all([
    listChatMessages(sessionId),
    getLatestConversationSummary(sessionId)
  ]);
  const recentMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-10);

  return {
    summary: latestSummary?.summary ?? "",
    recentConversation: recentMessages
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n")
      .slice(-5000)
  };
}

export async function safeSummarizeConversation(sessionId: string) {
  try {
    await maybeSummarizeConversation(sessionId);
  } catch (error) {
    console.error("Conversation summary update failed:", error);
  }
}

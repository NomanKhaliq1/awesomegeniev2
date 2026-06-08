import {
  getLatestConversationSummary,
  listChatMessages,
  saveConversationSummary
} from "@/lib/data/chatRepository";

const summaryEveryMessages = 8;

export async function maybeSummarizeConversation(sessionId: string) {
  const messages = await listChatMessages(sessionId);

  if (messages.length < summaryEveryMessages) {
    return null;
  }

  const latestSummary = await getLatestConversationSummary(sessionId);

  if (latestSummary && messages.length - latestSummary.message_count < summaryEveryMessages) {
    return latestSummary;
  }

  const importantMessages = messages.slice(-summaryEveryMessages);
  const summary = importantMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(0, 3000);

  return saveConversationSummary({
    sessionId,
    summary,
    messageCount: messages.length
  });
}

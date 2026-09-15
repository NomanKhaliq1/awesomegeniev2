import { listChatMessages, saveChatMessage } from "@/lib/data/chatRepository";

export const feedbackTags = [
  "helpful",
  "understood_requirements",
  "repeated_questions",
  "made_assumptions",
  "too_long"
] as const;

export type FeedbackTag = (typeof feedbackTags)[number];

export type SessionFeedback = {
  rating: number;
  tags: FeedbackTag[];
  comment: string;
  submittedAt: string;
};

export async function getSessionFeedback(sessionId: string): Promise<SessionFeedback | null> {
  const messages = await listChatMessages(sessionId);
  const feedbackMessage = [...messages]
    .reverse()
    .find((message) => message.role === "system" && message.metadata?.event === "interaction_feedback");

  if (!feedbackMessage) {
    return null;
  }

  const rating = Number(feedbackMessage.metadata.rating);
  const tags = Array.isArray(feedbackMessage.metadata.tags)
    ? feedbackMessage.metadata.tags.filter((tag): tag is FeedbackTag =>
        typeof tag === "string" && feedbackTags.includes(tag as FeedbackTag)
      )
    : [];

  return {
    rating: Number.isFinite(rating) ? rating : 0,
    tags,
    comment: typeof feedbackMessage.metadata.comment === "string" ? feedbackMessage.metadata.comment : "",
    submittedAt: feedbackMessage.created_at
  };
}

export async function saveSessionFeedback({
  sessionId,
  rating,
  tags,
  comment
}: {
  sessionId: string;
  rating: number;
  tags: FeedbackTag[];
  comment: string;
}) {
  const existing = await getSessionFeedback(sessionId);
  if (existing) {
    return { feedback: existing, created: false };
  }

  const submittedAt = new Date().toISOString();
  const message = await saveChatMessage({
    sessionId,
    role: "system",
    content: "Interaction feedback submitted.",
    metadata: {
      event: "interaction_feedback",
      rating,
      tags,
      comment,
      submittedAt
    }
  });

  if (!message) {
    return null;
  }

  return {
    created: true,
    feedback: {
      rating,
      tags,
      comment,
      submittedAt: message.created_at
    }
  };
}

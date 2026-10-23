import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import type {
  ChatMessageRow,
  ChatSessionRow,
  ConversationSummaryRow
} from "@/lib/supabase/types";

type CreateSessionInput = {
  missingFields?: string[];
  completionScore?: number;
  status?: string;
};

type SaveMessageInput = {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
};

type UpdateSessionProgressInput = {
  sessionId: string;
  completionScore: number;
  missingFields: string[];
  status?: string;
};

export async function createChatSession({
  missingFields = [],
  completionScore = 0,
  status = "collecting_core"
}: CreateSessionInput = {}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      completion_score: completionScore,
      missing_fields: missingFields,
      status
    })
    .select("*")
    .single<ChatSessionRow>();

  if (error) {
    console.error("Supabase createChatSession failed:", error.message);
    return null;
  }

  return data;
}

export async function getChatSession(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<ChatSessionRow>();

  if (error) {
    console.error("Supabase getChatSession failed:", error.message);
    return null;
  }

  return data;
}

export async function saveChatMessage({
  sessionId,
  role,
  content,
  metadata = {}
}: SaveMessageInput) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata
    })
    .select("*")
    .single<ChatMessageRow>();

  if (error) {
    console.error("Supabase saveChatMessage failed:", error.message);
    return null;
  }

  return data;
}

export async function listChatMessages(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<ChatMessageRow[]>();

  if (error) {
    console.error("Supabase listChatMessages failed:", error.message);
    return [];
  }

  return data ?? [];
}

export async function updateSessionProgress({
  sessionId,
  completionScore,
  missingFields,
  status
}: UpdateSessionProgressInput) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .update({
      completion_score: completionScore,
      missing_fields: missingFields,
      ...(status ? { status } : {})
    })
    .eq("id", sessionId)
    .select("*")
    .maybeSingle<ChatSessionRow>();

  if (error) {
    console.error("Supabase updateSessionProgress failed:", error.message);
    return null;
  }

  return data;
}

export async function saveConversationSummary({
  sessionId,
  summary,
  messageCount
}: {
  sessionId: string;
  summary: string;
  messageCount: number;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("conversation_summaries")
    .insert({
      session_id: sessionId,
      summary,
      message_count: messageCount
    })
    .select("*")
    .single<ConversationSummaryRow>();

  if (error) {
    console.error("Supabase saveConversationSummary failed:", error.message);
    return null;
  }

  return data;
}

export async function getLatestConversationSummary(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("conversation_summaries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ConversationSummaryRow>();

  if (error) {
    console.error("Supabase getLatestConversationSummary failed:", error.message);
    return null;
  }

  return data;
}

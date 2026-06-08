export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type OnboardingField = {
  id: string;
  service_category_id: string | null;
  field_key: string;
  label: string;
  question: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
  help_text: string | null;
};

export type ChatSessionRow = {
  id: string;
  client_id: string | null;
  status: string;
  completion_score: number;
  missing_fields: string[];
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ConversationSummaryRow = {
  id: string;
  session_id: string;
  summary: string;
  message_count: number;
  created_at: string;
};

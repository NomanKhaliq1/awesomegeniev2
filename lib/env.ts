import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX_NAME: z.string().default("awesome-genie-rag"),
  PINECONE_NAMESPACE_WEBSITE: z.string().default("website"),
  EMBEDDING_PROVIDER: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_DIMENSION: z.string().optional(),
  LLM_PROVIDER: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  SLM_PROVIDER: z.string().optional(),
  SLM_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  WORDPRESS_WEBHOOK_SECRET: z.string().optional(),
  WORDPRESS_BASE_URL: z.string().url().default("https://awesometechinc.com"),
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
  APP_URL: z.string().url().optional()
});

export const env = envSchema.parse(process.env);

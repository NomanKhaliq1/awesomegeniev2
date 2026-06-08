import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type CheckResult = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
};

const results: CheckResult[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, status: "pass", detail });
}

function warn(name: string, detail?: string) {
  results.push({ name, status: "warn", detail });
}

function fail(name: string, detail?: string) {
  results.push({ name, status: "fail", detail });
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function checkRequiredEnv(names: string[]) {
  for (const name of names) {
    if (hasEnv(name)) {
      pass(`env:${name}`);
    } else {
      fail(`env:${name}`, "Missing required environment variable.");
    }
  }
}

function providerKeyName(provider?: string) {
  const normalized = provider?.toLowerCase();

  if (normalized === "groq") return "GROQ_API_KEY";
  if (normalized === "openrouter") return "OPENROUTER_API_KEY";
  if (normalized === "gemini" || normalized === "google") return "GEMINI_API_KEY";
  if (normalized === "openai") return "OPENAI_API_KEY";

  return null;
}

function checkModelProvider(kind: "LLM" | "SLM") {
  const provider = process.env[`${kind}_PROVIDER`];
  const model = process.env[`${kind}_MODEL`];
  const keyName = providerKeyName(provider);

  if (provider) {
    pass(`env:${kind}_PROVIDER`, provider);
  } else {
    fail(`env:${kind}_PROVIDER`, "Missing provider.");
  }

  if (model) {
    pass(`env:${kind}_MODEL`, model);
  } else {
    fail(`env:${kind}_MODEL`, "Missing model.");
  }

  if (!keyName) {
    fail(`env:${kind}_provider_key`, `Unsupported provider: ${provider ?? "(missing)"}`);
    return;
  }

  if (hasEnv(keyName)) {
    pass(`env:${keyName}`, `Configured for ${kind}.`);
  } else {
    fail(`env:${keyName}`, `Required by ${kind}_PROVIDER=${provider}.`);
  }
}

function checkGoogleDriveConfig() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const normalizedKey = rawKey?.replace(/\\n/g, "\n");
  const hasPem =
    Boolean(normalizedKey?.includes("-----BEGIN PRIVATE KEY-----")) &&
    Boolean(normalizedKey?.includes("-----END PRIVATE KEY-----"));
  const hasOAuthBase =
    hasEnv("GOOGLE_OAUTH_CLIENT_ID") &&
    hasEnv("GOOGLE_OAUTH_CLIENT_SECRET") &&
    hasEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const hasOAuthRefreshToken = hasEnv("GOOGLE_OAUTH_REFRESH_TOKEN");

  if (hasOAuthBase) {
    pass("env:GOOGLE_OAUTH_CLIENT");
  } else {
    warn("env:GOOGLE_OAUTH_CLIENT", "Required for personal Google Drive OAuth upload.");
  }

  if (hasOAuthRefreshToken) {
    pass("env:GOOGLE_OAUTH_REFRESH_TOKEN");
  } else {
    warn("env:GOOGLE_OAUTH_REFRESH_TOKEN", "Open /api/google/oauth/start to generate it.");
  }

  if (hasEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID")) {
    pass("env:GOOGLE_DRIVE_ROOT_FOLDER_ID");
  } else {
    warn("env:GOOGLE_DRIVE_ROOT_FOLDER_ID", "Drive upload will be skipped/fail until configured.");
  }

  if (hasOAuthBase && hasOAuthRefreshToken) {
    pass("drive:auth_mode", "OAuth personal Drive upload configured.");
  } else if (rawKey && hasPem) {
    pass("env:GOOGLE_PRIVATE_KEY", "PEM format detected.");
  } else {
    warn(
      "drive:auth_mode",
      "OAuth refresh token is missing, and service-account private key is missing or not full PEM format."
    );
  }
}

function checkCronConfig() {
  if (hasEnv("CRON_SECRET")) {
    pass("env:CRON_SECRET", "Scheduled website sync can authenticate.");
  } else {
    warn("env:CRON_SECRET", "Scheduled website sync route will return 503 until configured.");
  }
}

function checkLangSmithConfig() {
  if (process.env.LANGCHAIN_TRACING_V2 !== "true") {
    warn("langsmith:tracing", "LANGCHAIN_TRACING_V2 is not true; dashboard traces are disabled.");
    return;
  }

  if (hasEnv("LANGCHAIN_API_KEY")) {
    pass("env:LANGCHAIN_API_KEY");
  } else {
    fail("env:LANGCHAIN_API_KEY", "Required when LANGCHAIN_TRACING_V2=true.");
  }

  if (hasEnv("LANGCHAIN_PROJECT")) {
    pass("env:LANGCHAIN_PROJECT", process.env.LANGCHAIN_PROJECT);
  } else {
    fail("env:LANGCHAIN_PROJECT", "Required when LANGCHAIN_TRACING_V2=true.");
  }
}

async function checkSupabasePrompts() {
  const { createOptionalSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    fail("supabase:client", "Supabase service credentials are missing.");
    return;
  }

  pass("supabase:client");

  const requiredPrompts = [
    "router.system",
    "router.user",
    "extract_memory.system",
    "extract_memory.user",
    "chat.opening_message",
    "chat.first_question",
    "chat.empty_message",
    "chat.irrelevant_message",
    "chat.generative_response_system",
    "chat.generative_response_user",
    "chat.generative_knowledge_response_system",
    "chat.generative_knowledge_response_user",
    "rag.website_answer_system",
    "rag.website_answer_user",
    "document_rag.answer_system",
    "document_rag.answer_user",
    "brief.generate_system",
    "brief.generate_user"
  ];

  const { data, error } = await supabase
    .from("prompt_templates")
    .select("name,is_active")
    .in("name", requiredPrompts);

  if (error) {
    fail("supabase:prompt_templates", error.message);
    return;
  }

  const activeNames = new Set(
    (data ?? [])
      .filter((row: { name: string; is_active: boolean }) => row.is_active)
      .map((row: { name: string }) => row.name)
  );
  const missing = requiredPrompts.filter((name) => !activeNames.has(name));

  if (missing.length === 0) {
    pass("supabase:required_prompt_templates", `${requiredPrompts.length} active prompts found.`);
  } else {
    fail("supabase:required_prompt_templates", `Missing active prompts: ${missing.join(", ")}`);
  }

  const obsoleteSavedAnswers = [
    "chat.onboarding_response",
    "chat.knowledge_response",
    "chat.file_response"
  ];
  const obsolete = await supabase
    .from("prompt_templates")
    .select("name,is_active")
    .in("name", obsoleteSavedAnswers);

  if (obsolete.error) {
    warn("supabase:saved_answer_templates", obsolete.error.message);
    return;
  }

  const stillActive = (obsolete.data ?? [])
    .filter((row: { is_active: boolean }) => row.is_active)
    .map((row: { name: string }) => row.name);

  if (stillActive.length === 0) {
    pass("supabase:saved_answer_templates", "Relevant saved-answer templates are inactive.");
  } else {
    fail(
      "supabase:saved_answer_templates",
      `Relevant saved-answer templates are still active: ${stillActive.join(", ")}`
    );
  }
}

async function checkPinecone() {
  const { getPineconeClient } = await import("@/lib/langchain/pineconeClient");
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!hasEnv("PINECONE_API_KEY") || !indexName) {
    fail("pinecone:index", "Pinecone API key or index name missing.");
    return;
  }

  try {
    const client = getPineconeClient();
    const indexes = await client.listIndexes();
    const names = new Set((indexes.indexes ?? []).map((index) => index.name));

    if (names.has(indexName)) {
      pass("pinecone:index", indexName);
    } else {
      fail("pinecone:index", `Index ${indexName} was not found.`);
    }
  } catch (error) {
    fail("pinecone:index", error instanceof Error ? error.message : String(error));
  }
}

async function checkNamespaceIsolation() {
  const { getSessionDocumentNamespace } = await import(
    "@/lib/langchain/ingestDocumentToPinecone"
  );

  const first = await getSessionDocumentNamespace("session-a");
  const second = await getSessionDocumentNamespace("session-b");

  if (first !== second && first.startsWith("session-") && second.startsWith("session-")) {
    pass("rag:session_namespace_isolation", `${first} != ${second}`);
  } else {
    fail("rag:session_namespace_isolation", "Session namespaces are not isolated.");
  }
}

async function main() {
  checkRequiredEnv([
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PINECONE_API_KEY",
    "PINECONE_INDEX_NAME",
    "PINECONE_NAMESPACE_WEBSITE",
    "EMBEDDING_PROVIDER",
    "EMBEDDING_MODEL",
    "EMBEDDING_DIMENSION"
  ]);
  checkModelProvider("LLM");
  checkModelProvider("SLM");
  checkGoogleDriveConfig();
  checkCronConfig();
  checkLangSmithConfig();

  await checkNamespaceIsolation();
  await checkSupabasePrompts();
  await checkPinecone();

  for (const result of results) {
    const prefix =
      result.status === "pass" ? "[pass]" : result.status === "warn" ? "[warn]" : "[fail]";
    console.log(`${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  }

  const failed = results.filter((result) => result.status === "fail");
  const warned = results.filter((result) => result.status === "warn");

  console.log(`\nProduction check: ${failed.length} failed, ${warned.length} warnings.`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Production check crashed:", error);
  process.exit(1);
});

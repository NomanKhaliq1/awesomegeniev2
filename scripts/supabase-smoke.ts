import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

loadEnvConfig(process.cwd());

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false
      },
      realtime: {
        transport: WebSocket as never
      }
    }
  );

  const { count: serviceCategoryCount, error: serviceCategoryError } = await supabase
    .from("service_categories")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  if (serviceCategoryError) {
    throw new Error(`service_categories check failed: ${serviceCategoryError.message}`);
  }

  const { data: mortgageAutomation, error: categoryError } = await supabase
    .from("service_categories")
    .select("id, slug")
    .eq("slug", "mortgage-automation")
    .single();

  if (categoryError) {
    throw new Error(`mortgage-automation seed missing: ${categoryError.message}`);
  }

  const { count: onboardingFieldCount, error: onboardingFieldError } = await supabase
    .from("onboarding_fields")
    .select("*", { count: "exact", head: true })
    .eq("service_category_id", mortgageAutomation.id);

  if (onboardingFieldError) {
    throw new Error(`onboarding_fields check failed: ${onboardingFieldError.message}`);
  }

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .insert({
      completion_score: 0,
      missing_fields: ["Company name"]
    })
    .select("id")
    .single();

  if (sessionError) {
    throw new Error(`chat_sessions insert failed: ${sessionError.message}`);
  }

  const { data: message, error: messageError } = await supabase
    .from("chat_messages")
    .insert({
      session_id: session.id,
      role: "user",
      content: "Supabase smoke test message"
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(`chat_messages insert failed: ${messageError.message}`);
  }

  const { data: requirement, error: requirementError } = await supabase
    .from("client_requirements")
    .insert({
      session_id: session.id,
      structured_memory: {
        smoke_test: true
      }
    })
    .select("id")
    .single();

  if (requirementError) {
    throw new Error(`client_requirements insert failed: ${requirementError.message}`);
  }

  const { error: valueError } = await supabase
    .from("client_requirement_values")
    .insert({
      requirement_id: requirement.id,
      field_key: "smoke_test",
      value: "true",
      value_json: { value: true },
      source_message_id: message.id
    });

  if (valueError) {
    throw new Error(`client_requirement_values insert failed: ${valueError.message}`);
  }

  console.log("Supabase smoke test passed");
  console.log(`Service categories: ${serviceCategoryCount ?? 0}`);
  console.log(`Mortgage Automation fields: ${onboardingFieldCount ?? 0}`);
  console.log(`Test session: ${session.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};

import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export type RequirementMemory = Record<string, string | number | boolean | null>;

type EnsureRequirementInput = {
  sessionId: string;
  clientId?: string | null;
  serviceCategoryId?: string | null;
};

type UpdateRequirementMemoryInput = {
  sessionId: string;
  memory: RequirementMemory;
  sourceMessageId?: string | null;
};

type RequirementRow = {
  id: string;
  client_id: string | null;
  session_id: string;
  service_category_id: string | null;
  structured_memory: RequirementMemory;
};

export type ClientRequirementRow = RequirementRow;

export async function ensureClientRequirement({
  sessionId,
  clientId = null,
  serviceCategoryId = null
}: EnsureRequirementInput) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data: existingRequirement, error: readError } = await supabase
    .from("client_requirements")
    .select("id, client_id, session_id, service_category_id, structured_memory")
    .eq("session_id", sessionId)
    .maybeSingle<RequirementRow>();

  if (readError) {
    console.error("Supabase ensureClientRequirement read failed:", readError.message);
    return null;
  }

  if (existingRequirement) {
    return existingRequirement;
  }

  const { data, error } = await supabase
    .from("client_requirements")
    .insert({
      session_id: sessionId,
      client_id: clientId,
      service_category_id: serviceCategoryId,
      structured_memory: {}
    })
    .select("id, client_id, session_id, service_category_id, structured_memory")
    .single<RequirementRow>();

  if (error) {
    console.error("Supabase ensureClientRequirement insert failed:", error.message);
    return null;
  }

  return data;
}

export async function getRequirementMemory(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return {};
  }

  const { data, error } = await supabase
    .from("client_requirements")
    .select("structured_memory")
    .eq("session_id", sessionId)
    .maybeSingle<{ structured_memory: RequirementMemory }>();

  if (error) {
    console.error("Supabase getRequirementMemory failed:", error.message);
    return {};
  }

  return data?.structured_memory ?? {};
}

export async function getClientRequirement(sessionId: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("client_requirements")
    .select("id, client_id, session_id, service_category_id, structured_memory")
    .eq("session_id", sessionId)
    .maybeSingle<RequirementRow>();

  if (error) {
    console.error("Supabase getClientRequirement failed:", error.message);
    return null;
  }

  return data;
}

export async function updateRequirementMemory({
  sessionId,
  memory,
  sourceMessageId = null
}: UpdateRequirementMemoryInput) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const requirement = await ensureClientRequirement({ sessionId });

  if (!requirement) {
    return null;
  }

  const nextMemory = {
    ...(requirement.structured_memory ?? {}),
    ...memory
  };

  const { data, error } = await supabase
    .from("client_requirements")
    .update({
      structured_memory: nextMemory
    })
    .eq("id", requirement.id)
    .select("id, client_id, session_id, service_category_id, structured_memory")
    .single<RequirementRow>();

  if (error) {
    console.error("Supabase updateRequirementMemory failed:", error.message);
    return null;
  }

  const valueRows = Object.entries(memory).map(([fieldKey, value]) => ({
    requirement_id: requirement.id,
    field_key: fieldKey,
    value: value === null || value === undefined ? null : String(value),
    value_json: { value },
    source_message_id: sourceMessageId
  }));

  if (valueRows.length > 0) {
    const { error: valuesError } = await supabase
      .from("client_requirement_values")
      .upsert(valueRows, {
        onConflict: "requirement_id,field_key"
      });

    if (valuesError) {
      console.error("Supabase requirement values upsert failed:", valuesError.message);
    }
  }

  return data;
}

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

  const cleanValue = (v: any) => {
    if (v === null || v === undefined) return null;
    const str = String(v).trim();
    if (str === "" || str === "null" || str === "undefined") return null;
    return v;
  };

  const cleanedMemory: RequirementMemory = {};
  const fieldsToRemove = new Set<string>();
  for (const [key, value] of Object.entries(memory)) {
    if (value === null) {
      fieldsToRemove.add(key);
      continue;
    }
    const val = cleanValue(value);
    if (val !== null) {
      cleanedMemory[key] = val;
    }
  }

  const cleanedExistingMemory: RequirementMemory = {};
  for (const [key, value] of Object.entries(requirement.structured_memory ?? {})) {
    const val = cleanValue(value);
    if (val !== null) {
      cleanedExistingMemory[key] = val;
    }
  }

  const nextMemory = {
    ...cleanedExistingMemory,
    ...cleanedMemory
  };
  for (const key of fieldsToRemove) {
    delete nextMemory[key];
  }

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

  const valueRows = Object.entries(memory).map(([fieldKey, value]) => {
    const val = cleanValue(value);
    return {
      requirement_id: requirement.id,
      field_key: fieldKey,
      value: val === null ? null : String(val),
      value_json: { value: val },
      source_message_id: sourceMessageId
    };
  });

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

import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

type PromptTemplateRow = {
  template: string;
};

type SystemSettingRow = {
  value: unknown;
};

export async function getSystemSetting<T>(key: string, fallback?: T): Promise<T> {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`System setting ${key} is not configured.`);
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle<SystemSettingRow>();

  if (error || data?.value === undefined || data.value === null) {
    if (error) {
      console.error(`Supabase getSystemSetting failed for ${key}:`, error.message);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`System setting ${key} is not configured.`);
  }

  return data.value as T;
}

export async function getPromptTemplate(name: string, fallback?: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Prompt template ${name} is not configured.`);
  }

  const { data, error } = await supabase
    .from("prompt_templates")
    .select("template")
    .eq("name", name)
    .eq("is_active", true)
    .maybeSingle<PromptTemplateRow>();

  if (error || !data?.template) {
    if (error) {
      console.error(`Supabase getPromptTemplate failed for ${name}:`, error.message);
    }

    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Prompt template ${name} is not configured.`);
  }

  return data.template;
}

export function renderTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

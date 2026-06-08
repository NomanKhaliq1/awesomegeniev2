import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import type { OnboardingField, ServiceCategory } from "@/lib/supabase/types";

export async function listServiceCategories() {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<ServiceCategory[]>();

  if (error) {
    console.error("Supabase listServiceCategories failed:", error.message);
    return [];
  }

  return data ?? [];
}

export async function listOnboardingFields(serviceCategorySlug?: string) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return [];
  }

  if (!serviceCategorySlug) {
    const { data, error } = await supabase
      .from("onboarding_fields")
      .select("*")
      .order("sort_order", { ascending: true })
      .returns<OnboardingField[]>();

    if (error) {
      console.error("Supabase listOnboardingFields failed:", error.message);
      return [];
    }

    return data ?? [];
  }

  const { data, error } = await supabase
    .from("onboarding_fields")
    .select("*, service_categories!inner(slug)")
    .eq("service_categories.slug", serviceCategorySlug)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Supabase listOnboardingFields by service failed:", error.message);
    return [];
  }

  return (data ?? []).map(({ service_categories: _serviceCategories, ...field }) => field as OnboardingField);
}

import { listOnboardingFields } from "@/lib/data/configRepository";

export async function loadOnboardingFields(serviceCategorySlug?: string) {
  return listOnboardingFields(serviceCategorySlug);
}

import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getSystemSetting } from "@/lib/data/settingsRepository";

export type OnboardingState =
  | "collecting_core"
  | "collecting_service_details"
  | "ready_for_files"
  | "ready_to_complete";

export function getOnboardingState({
  completionScore,
  missingFields,
  memory
}: {
  completionScore: number;
  missingFields: string[];
  memory: RequirementMemory;
}): OnboardingState {
  if (completionScore >= 100 && missingFields.length === 0) {
    return "ready_to_complete";
  }

  if (completionScore >= 75 && typeof memory.service_type === "string") {
    return "ready_for_files";
  }

  if (typeof memory.service_type === "string") {
    return "collecting_service_details";
  }

  return "collecting_core";
}

export async function getStateLabel(state: OnboardingState) {
  const labels =
    await getSystemSetting<Record<OnboardingState, string>>("onboarding_state_labels");

  return labels[state];
}

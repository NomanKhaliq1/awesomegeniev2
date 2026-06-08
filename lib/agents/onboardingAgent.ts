import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { calculateCompletionScore } from "@/lib/onboarding/calculateCompletionScore";
import { extractRequirementMemory } from "@/lib/onboarding/extractRequirementMemory";
import { getMissingRequiredFields } from "@/lib/onboarding/fields";
import { getNextQuestion } from "@/lib/onboarding/getNextQuestion";
import { loadOnboardingFields } from "@/lib/onboarding/loadOnboardingFields";
import { serviceNameToSlug } from "@/lib/onboarding/serviceSlug";

export type OnboardingAgentResult = {
  extractedMemory: RequirementMemory;
  nextMemory: RequirementMemory;
  completionScore: number;
  missingFields: string[];
  nextQuestion: string | null;
};

type RunOnboardingAgentOptions = {
  useSlm?: boolean;
};

export async function runOnboardingAgent(
  currentMemory: RequirementMemory,
  message: string,
  { useSlm = true }: RunOnboardingAgentOptions = {}
): Promise<OnboardingAgentResult> {
  const extractedMemory = await extractRequirementMemory(message, { useSlm });
  const nextMemory = {
    ...currentMemory,
    ...extractedMemory
  };
  const coreMissingFields = await getMissingRequiredFields(nextMemory);
  const serviceSlug = serviceNameToSlug(
    typeof nextMemory.service_type === "string" ? nextMemory.service_type : null
  );
  const serviceFields = serviceSlug ? await loadOnboardingFields(serviceSlug) : [];
  const missingServiceFields = serviceFields.filter((field) => {
    if (!field.is_required) {
      return false;
    }

    const value = nextMemory[field.field_key];

    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    return value === undefined || value === null;
  });
  const missingFields = [
    ...coreMissingFields.map((field) => field.label),
    ...missingServiceFields.map((field) => field.label)
  ];
  const completionScore = await calculateCompletionScore(nextMemory);
  const nextQuestion =
    (await getNextQuestion(nextMemory)) ?? missingServiceFields[0]?.question ?? null;

  return {
    extractedMemory,
    nextMemory,
    completionScore,
    missingFields,
    nextQuestion
  };
}

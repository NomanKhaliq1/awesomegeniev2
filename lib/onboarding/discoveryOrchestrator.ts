import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { extractRequirementMemory, validateRequirementMemory } from "@/lib/onboarding/extractRequirementMemory";
import { getMissingRequiredFields, calculateReadinessScore, calculateCompletionScore } from "@/lib/onboarding/fields";
import { listOnboardingFields } from "@/lib/data/configRepository";
import { serviceNameToSlug } from "@/lib/onboarding/serviceSlug";
import { calculateConfidenceScore, getConfidenceLevel } from "@/lib/onboarding/discovery";
import { evaluateConversationState } from "@/lib/onboarding/conversationStateManager";
import {
  advanceConversationStage,
  collectAskedQuestions,
  mapDiscoveryStage,
  mergeConversationMemory
} from "@/lib/onboarding/conversationControl";

export type DiscoveryOrchestratorResult = {
  extractedMemory: RequirementMemory;
  nextMemory: RequirementMemory;
  completionScore: number;
  confidenceScore: number;
  confidenceLevel: string;
  missingFields: string[];
  nextQuestion: string | null;
  validationAlerts: string[];
  readinessScore: number;
};

type DiscoveryOrchestratorOptions = {
  useSlm?: boolean;
  recentConversation?: string;
};

export async function runDiscoveryOrchestrator(
  currentMemory: RequirementMemory,
  message: string,
  { useSlm = true, recentConversation }: DiscoveryOrchestratorOptions = {}
): Promise<DiscoveryOrchestratorResult> {
  const rawExtracted = await extractRequirementMemory(message, { useSlm });
  
  // Run Enterprise sanitization & validation
  const { sanitized, alerts } = validateRequirementMemory(rawExtracted);

  const { nextMemory, persistencePatch } = mergeConversationMemory(
    currentMemory,
    sanitized,
    message
  );
  const extractedMemory = persistencePatch;
  const coreMissingFields = await getMissingRequiredFields(nextMemory);
  const serviceSlug = serviceNameToSlug(
    typeof nextMemory.service_type === "string" ? nextMemory.service_type : null
  );
  const serviceFields = serviceSlug ? await listOnboardingFields(serviceSlug) : [];
  const missingServiceFields = serviceFields.filter((field) => {
    if (!field.is_required) {
      return false;
    }

    const value = nextMemory[field.field_key];

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length === 0 || trimmed === "null" || trimmed === "undefined";
    }

    return value === undefined || value === null;
  });

  const missingFields = [
    ...coreMissingFields.map((field) => {
      const prefix =
        field.priority === "critical"
          ? "[Critical] "
          : field.priority === "important"
          ? "[Important] "
          : "[Optional] ";
      return `${prefix}${field.label}`;
    }),
    ...missingServiceFields.map((field) => `[Important] ${field.label}`)
  ];

  const completionScore = await calculateCompletionScore(nextMemory);
  const confidenceScore = calculateConfidenceScore(nextMemory);
  const confidenceLevel = getConfidenceLevel(confidenceScore);

  // Calculate recommendation readiness score based on completed critical fields
  const readinessScore = calculateReadinessScore(nextMemory);
  const conversationState = evaluateConversationState({
    memory: nextMemory,
    recentConversation,
    lastUserMessage: message
  });
  const currentStage = advanceConversationStage(
    nextMemory.current_stage,
    mapDiscoveryStage(conversationState.stage)
  );
  const confirmedFacts = Object.keys(nextMemory)
    .filter((key) => !["confirmed_facts", "open_items", "asked_questions", "rejected_facts", "current_stage", "brief_status", "latest_project_note"].includes(key))
    .filter((key) => nextMemory[key] !== null && nextMemory[key] !== undefined && String(nextMemory[key]).trim().length > 0)
    .sort()
    .join("|");
  const askedQuestions = collectAskedQuestions(recentConversation);

  Object.assign(nextMemory, {
    current_stage: currentStage,
    confirmed_facts: confirmedFacts,
    open_items: missingFields.length ? missingFields.join("|") : null
  });
  Object.assign(extractedMemory, {
    current_stage: currentStage,
    confirmed_facts: confirmedFacts,
    open_items: missingFields.length ? missingFields.join("|") : null
  });
  if (askedQuestions) {
    nextMemory.asked_questions = askedQuestions;
    extractedMemory.asked_questions = askedQuestions;
  }
  
  const nextQuestion = conversationState.nextQuestion ?? missingServiceFields[0]?.question ?? null;

  return {
    extractedMemory,
    nextMemory,
    completionScore,
    confidenceScore,
    confidenceLevel,
    missingFields,
    nextQuestion,
    validationAlerts: alerts,
    readinessScore
  };
}

import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getCoreRequiredFields, getMissingRequiredFields } from "./fields";

export async function calculateCompletionScore(memory: RequirementMemory) {
  const [coreRequiredFields, missingFields] = await Promise.all([
    getCoreRequiredFields(),
    getMissingRequiredFields(memory)
  ]);
  const missingCount = missingFields.length;
  const completedCount = coreRequiredFields.length - missingCount;

  return Math.round((completedCount / coreRequiredFields.length) * 100);
}

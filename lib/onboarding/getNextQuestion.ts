import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getMissingRequiredFields } from "./fields";

export async function getNextQuestion(memory: RequirementMemory) {
  const missingFields = await getMissingRequiredFields(memory);

  return missingFields[0]?.question ?? null;
}

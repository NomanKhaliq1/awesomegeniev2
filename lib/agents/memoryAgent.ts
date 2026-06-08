import {
  getRequirementMemory,
  type RequirementMemory
} from "@/lib/data/requirementsRepository";
import { updateRequirementMemory } from "@/lib/onboarding/updateRequirementMemory";

export async function loadMemory(sessionId: string): Promise<RequirementMemory> {
  return getRequirementMemory(sessionId);
}

export async function saveMemory(
  sessionId: string,
  memory: RequirementMemory,
  sourceMessageId?: string | null
) {
  return updateRequirementMemory(sessionId, memory, sourceMessageId);
}

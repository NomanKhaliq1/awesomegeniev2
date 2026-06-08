import {
  updateRequirementMemory as persistRequirementMemory,
  type RequirementMemory
} from "@/lib/data/requirementsRepository";

export async function updateRequirementMemory(
  sessionId: string,
  memory: RequirementMemory,
  sourceMessageId?: string | null
) {
  return persistRequirementMemory({
    sessionId,
    memory,
    sourceMessageId
  });
}

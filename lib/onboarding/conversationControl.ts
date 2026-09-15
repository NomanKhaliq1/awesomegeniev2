import type { RequirementMemory } from "@/lib/data/requirementsRepository";

export type ClientConversationStage =
  | "initial_intake"
  | "workflow_discovery"
  | "priority_discovery"
  | "constraints_discovery"
  | "contact_capture"
  | "brief_ready"
  | "brief_generated"
  | "brief_revision"
  | "brief_approved"
  | "scoping_ready"
  | "handoff_complete";

type RejectedFactDefinition = {
  label: string;
  pattern: RegExp;
};

const REJECTABLE_FACTS: RejectedFactDefinition[] = [
  { label: "Encompass", pattern: /\bencompass\b/i },
  { label: "HubSpot", pattern: /\bhubspot\b/i },
  { label: "Salesforce", pattern: /\bsalesforce\b/i },
  { label: "custom plugin", pattern: /\bcustom\s+(?:encompass\s+)?plugin\b/i },
  { label: "title vendor follow-up", pattern: /\btitle(?:\s+vendor)?(?:\s+follow[- ]?up)?\b/i },
  { label: "appraisal vendor follow-up", pattern: /\bappraisal(?:\s+vendor)?(?:\s+follow[- ]?up)?\b/i },
  { label: "vendor follow-up", pattern: /\bvendor(?:\s+coordination|\s+follow[- ]?ups?|\s+automation)?\b/i },
  { label: "internal operations portal", pattern: /\binternal(?:\s+operations?)?\s+portal\b/i },
  { label: "dashboard", pattern: /\bdashboards?\b/i },
  { label: "real-time synchronization", pattern: /\breal[- ]time(?:\s+synchroni[sz]ation|\s+sync|\s+updates?)?\b/i }
];

const REVISION_PATTERN =
  /\b(?:update|revise|edit|adjust|change|correct|rewrite|replace|remove|exclude|omit|return|show|keep|move)\b[\s\S]{0,100}\b(?:brief|section|sections|business goals|workflow details|reference|references|wording|phase|phases)\b|\b(?:do not|don'?t)\s+(?:repeat|regenerate|include|mention|assume)\b|\bonly\s+(?:the\s+)?(?:corrected\s+)?sections?\b/i;

const BRIEF_REQUEST_PATTERN =
  /\b(?:prepare|create|generate|write|produce)\b[\s\S]{0,60}\b(?:project\s+brief|brief|project\s+summary)\b|^\s*(?:project\s+brief|brief)\s*[.!?]*$/i;

const CONTROL_MESSAGE_PATTERN =
  /\b(?:brief|section|wording|generic|not confirmed|not shared|do not|don'?t|remove|exclude|omit|return only|corrected sections?|regenerate)\b/i;

const PROTECTED_DISCOVERY_FIELDS = new Set([
  "project_overview",
  "business_problem",
  "pain_points",
  "current_process",
  "teams_involved",
  "primary_bottleneck",
  "root_cause_summary",
  "desired_outcome",
  "goals",
  "channels",
  "required_features",
  "service_type"
]);

export function isBriefRevisionIntent(message: string) {
  return REVISION_PATTERN.test(message);
}

export function isExplicitBriefGenerationIntent(message: string) {
  return BRIEF_REQUEST_PATTERN.test(message) && !isBriefRevisionIntent(message);
}

export function extractRejectedFacts(message: string): string[] {
  const rejectionContext =
    /\b(?:remove|exclude|omit|delete|drop|reject|not confirmed|not shared|never mentioned|do not include|don'?t include|do not mention|don'?t mention|do not assume|don'?t assume|avoid assuming|keep (?:it|the wording|system names?) generic|explicitly excluded)\b/i;

  if (!rejectionContext.test(message)) {
    return [];
  }

  return REJECTABLE_FACTS
    .filter(({ pattern }) => pattern.test(message))
    .map(({ label }) => label);
}

export function getRejectedFacts(memory: RequirementMemory): string[] {
  const value = memory.rejected_facts;
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return Array.from(new Set(value.split("|").map((item) => item.trim()).filter(Boolean)));
}

export function textContainsRejectedFact(text: string, memory: RequirementMemory) {
  const rejected = new Set(getRejectedFacts(memory).map((item) => item.toLowerCase()));
  return REJECTABLE_FACTS.some(
    ({ label, pattern }) => rejected.has(label.toLowerCase()) && pattern.test(text)
  );
}

export function filterRejectedList(value: unknown, memory: RequirementMemory): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const rejected = new Set(getRejectedFacts(memory).map((item) => item.toLowerCase()));
  const kept = value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !REJECTABLE_FACTS.some(
      ({ label, pattern }) => rejected.has(label.toLowerCase()) && pattern.test(item)
    ));

  return kept.length > 0 ? kept.join("; ") : null;
}

export function mergeConversationMemory(
  currentMemory: RequirementMemory,
  extractedMemory: RequirementMemory,
  message: string
): { nextMemory: RequirementMemory; persistencePatch: RequirementMemory } {
  const correctionMessage = CONTROL_MESSAGE_PATTERN.test(message);
  const accepted: RequirementMemory = {};

  for (const [key, value] of Object.entries(extractedMemory)) {
    if (correctionMessage && PROTECTED_DISCOVERY_FIELDS.has(key)) {
      continue;
    }
    accepted[key] = value;
  }

  const rejectedFacts = Array.from(new Set([
    ...getRejectedFacts(currentMemory),
    ...extractRejectedFacts(message)
  ]));
  const nextMemory: RequirementMemory = {
    ...currentMemory,
    ...accepted,
    ...(rejectedFacts.length > 0 ? { rejected_facts: rejectedFacts.join("|") } : {})
  };
  const persistencePatch: RequirementMemory = {
    ...accepted,
    ...(rejectedFacts.length > 0 ? { rejected_facts: rejectedFacts.join("|") } : {})
  };

  for (const field of ["existing_systems", "existing_tools", "integration_requirements", "required_features", "goals"] as const) {
    if (!(field in nextMemory)) continue;
    const filtered = filterRejectedList(nextMemory[field], nextMemory);
    nextMemory[field] = filtered;
    persistencePatch[field] = filtered;
  }

  if (isBriefRevisionIntent(message)) {
    nextMemory.current_stage = "brief_revision";
    nextMemory.brief_status = "revision";
    persistencePatch.current_stage = "brief_revision";
    persistencePatch.brief_status = "revision";
  }

  return { nextMemory, persistencePatch };
}

export function markConversationStage(
  stage: ClientConversationStage,
  briefStatus?: "ready" | "generated" | "revision" | "approved" | "handoff_complete"
): RequirementMemory {
  return {
    current_stage: stage,
    ...(briefStatus ? { brief_status: briefStatus } : {})
  };
}

const STAGE_ORDER: ClientConversationStage[] = [
  "initial_intake",
  "workflow_discovery",
  "priority_discovery",
  "constraints_discovery",
  "contact_capture",
  "brief_ready",
  "brief_generated",
  "brief_revision",
  "brief_approved",
  "scoping_ready",
  "handoff_complete"
];

export function advanceConversationStage(
  currentStage: unknown,
  proposedStage: ClientConversationStage
): ClientConversationStage {
  const current = typeof currentStage === "string"
    ? STAGE_ORDER.indexOf(currentStage as ClientConversationStage)
    : -1;
  const proposed = STAGE_ORDER.indexOf(proposedStage);
  return current > proposed ? STAGE_ORDER[current] : proposedStage;
}

export function mapDiscoveryStage(stage: string): ClientConversationStage {
  if (["problem_discovery", "current_process", "teams_involved", "bottleneck", "root_cause_validation"].includes(stage)) {
    return "workflow_discovery";
  }
  if (stage === "desired_outcome") return "priority_discovery";
  if (stage === "systems_constraints") return "constraints_discovery";
  if (["qualification", "lead_capture"].includes(stage)) return "contact_capture";
  if (stage === "project_brief") return "brief_ready";
  if (stage === "drive_handoff") return "scoping_ready";
  return "priority_discovery";
}

export function collectAskedQuestions(recentConversation = "") {
  const questions = recentConversation
    .split(/\n(?=(?:user|assistant):)/i)
    .filter((line) => /^assistant:/i.test(line.trim()))
    .flatMap((line) => line.match(/[^?\n]+\?/g) ?? [])
    .map((question) => question.replace(/^assistant:\s*/i, "").trim())
    .filter(Boolean);
  return Array.from(new Set(questions)).slice(-20).join("|");
}

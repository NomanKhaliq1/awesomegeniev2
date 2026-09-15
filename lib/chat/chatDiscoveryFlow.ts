export function isNextStepIntent(userMessage: string): boolean {
  const normalized = userMessage.toLowerCase();
  return (
    normalized.includes("next step") ||
    normalized.includes("next steps") ||
    normalized.includes("how do we start") ||
    normalized.includes("how to start") ||
    normalized.includes("how to proceed") ||
    normalized.includes("how do we proceed") ||
    normalized.includes("move forward") ||
    normalized.includes("moving forward") ||
    normalized.includes("evaluate this") ||
    normalized.includes("prepare a solution plan")
  );
}

export function buildWorkflowDocumentUploadResponse(userMessage: string) {
  const normalized = userMessage.toLowerCase();

  const reviewItems = [
    normalized.includes("loan status") ? "loan status update process" : null,
    normalized.includes("hubspot") ? "HubSpot update points" : null,
    normalized.includes("borrower") ? "borrower notification triggers" : null,
    normalized.includes("title") || normalized.includes("appraisal") || normalized.includes("vendor")
      ? "vendor follow-up steps"
      : null,
    normalized.includes("duplicated") || normalized.includes("duplicate") ? "duplicated fields" : null,
    normalized.includes("handoff") ? "manual handoffs" : null
  ].filter(Boolean);

  const reviewSummary = reviewItems.length > 0
    ? formatHumanList(reviewItems)
    : "workflow steps, system update points, notification triggers, duplicated fields, and manual handoffs";

  return `Yes, please upload/share the workflow document here. It is directly related to the project we are scoping. We’ll review it before the scoping session to validate the ${reviewSummary}. After reviewing it, we can help update the project brief for our sales and implementation teams.`;
}

function formatHumanList(items: Array<string | null>) {
  const cleanItems = items.filter(Boolean) as string[];

  if (cleanItems.length <= 2) {
    return cleanItems.join(" and ");
  }

  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems[cleanItems.length - 1]}`;
}

export function countKnownCategories(memory?: Record<string, string | number | boolean | null>): number {
  if (!memory) {
    return 0;
  }

  let knownCount = 0;
  const hasValue = (val: unknown): boolean => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
    }
    return val !== undefined && val !== null;
  };

  if (hasValue(memory.existing_systems)) knownCount += 1;
  if (hasValue(memory.project_overview) || hasValue(memory.required_features)) knownCount += 1;
  if (hasValue(memory.pain_points) || hasValue(memory.business_problem)) knownCount += 1;
  if (hasValue(memory.goals)) knownCount += 1;
  if (hasValue(memory.support_workload) || hasValue(memory.inquiry_volume) || hasValue(memory.team_size)) {
    knownCount += 1;
  }
  if (hasValue(memory.timeline) || hasValue(memory.budget_range)) knownCount += 1;

  return knownCount;
}

export function hasBasicContext(memory: Record<string, string | number | boolean | null>): boolean {
  const hasValue = (val: unknown): boolean => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
    }
    return val !== undefined && val !== null;
  };

  return (
    hasValue(memory.company_name) ||
    hasValue(memory.contact_name) ||
    hasValue(memory.email) ||
    hasValue(memory.project_overview) ||
    hasValue(memory.business_problem) ||
    hasValue(memory.pain_points) ||
    hasValue(memory.goals) ||
    hasValue(memory.existing_systems)
  );
}

function getLastAssistantMessage(recentConversation: string): string | null {
  const lines = recentConversation.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.toLowerCase().startsWith("assistant:")) {
      return line.slice("assistant:".length).trim();
    }
  }
  return null;
}

function getWordSet(text: string): Set<string> {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 0);
  return new Set(words);
}

function calculateJaccardSimilarity(s1: string, s2: string): number {
  const set1 = getWordSet(s1);
  const set2 = getWordSet(s2);
  if (set1.size === 0 && set2.size === 0) return 1;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function extractQuestion(text: string): string | null {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.toLowerCase().startsWith("next question:")) {
      return line.slice("next question:".length).trim();
    }
    if (line.toLowerCase().startsWith("next question")) {
      return line.slice("next question".length).trim();
    }
  }
  const match = text.match(/[^.!?]*\?/g);
  if (match && match.length > 0) {
    return match[match.length - 1].trim();
  }
  return null;
}

export function ensureUniqueResponse(response: string, recentConversation: string, targetLanguage: string): string {
  const lastAssistantMsg = getLastAssistantMessage(recentConversation);
  if (!lastAssistantMsg) {
    return response;
  }

  const clean = (s: string) => s.toLowerCase().replace(/[^\w]/g, "");

  const cleanResponse = clean(response);
  const cleanLast = clean(lastAssistantMsg);

  let isDuplicate = cleanResponse === cleanLast;

  if (!isDuplicate) {
    const similarity = calculateJaccardSimilarity(response, lastAssistantMsg);
    if (similarity > 0.85) {
      isDuplicate = true;
    }
  }

  if (!isDuplicate) {
    const newQ = extractQuestion(response);
    const lastQ = extractQuestion(lastAssistantMsg);
    if (newQ && lastQ && clean(newQ) === clean(lastQ)) {
      isDuplicate = true;
    }
  }

  if (isDuplicate) {
    console.warn("[ensureUniqueResponse] Detected duplicate/near-duplicate assistant response. Appending uniqueness fallback.");
    const suffix = targetLanguage === "roman_urdu"
      ? "\n\nIs ke ilawa, kya aap scoping session se pehle koi aur specific details discuss karna chahte hain?"
      : "\n\nAdditionally, is there any other specific detail you would like to discuss before the scoping session?";
    return `${response}${suffix}`;
  }

  return response;
}

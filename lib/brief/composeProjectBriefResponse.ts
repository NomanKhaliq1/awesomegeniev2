import type { DocumentSourceRow } from "@/lib/data/fileRepository";
import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import {
  filterRejectedList,
  extractRejectedFacts,
  getRejectedFacts,
  textContainsRejectedFact
} from "@/lib/onboarding/conversationControl";
import {
  applySectionReplacements,
  parseStoredSectionReplacements
} from "@/lib/brief/sectionRevision";

type ComposeProjectBriefResponseInput = {
  userMessage: string;
  collectedMemory: RequirementMemory;
  conversationSummary?: string;
  recentConversation?: string;
  documentSources?: DocumentSourceRow[];
};

export type BriefFacts = {
  company: string | null;
  contact: string | null;
  role: string | null;
  email: string | null;
  timeline: string | null;
  systems: string[];
  goals: string[];
  workflowProblems: string[];
  workflowDetails: string;
  priorities: string[];
  constraints: string[];
  laterPhases: string[];
};

const UNKNOWN = "Not confirmed yet";

export function composeProjectBriefResponse({
  userMessage,
  collectedMemory,
  conversationSummary = "",
  recentConversation = "",
  documentSources = []
}: ComposeProjectBriefResponseInput) {
  collectedMemory = withMessageRejections(collectedMemory, userMessage);
  const clientConversation = extractClientMessages(recentConversation);
  const currentFacts = [
    clientConversation,
    userMessage,
    memoryFactText(collectedMemory)
  ].filter(Boolean).join("\n");
  const facts = extractBriefFacts(collectedMemory, currentFacts, currentFacts);
  const hasUploadedDocs = documentSources.length > 0;
  const openItems = buildOpenItems(facts);

  const brief = [
    "Official Project Brief for Our Sales and Implementation Teams",
    "",
    "Contact and Company Details",
    "",
    `* Company: ${facts.company ?? UNKNOWN}`,
    `* Contact name: ${facts.contact ?? UNKNOWN}`,
    `* Contact role: ${facts.role ?? UNKNOWN}`,
    `* Email: ${facts.email ? `[${facts.email}](mailto:${facts.email})` : UNKNOWN}`,
    "",
    "Timeline",
    "",
    facts.timeline ?? UNKNOWN,
    "",
    "Systems Involved",
    "",
    ...(facts.systems.length ? facts.systems : ["Systems to confirm during discovery"]).map((item) => `* ${item}`),
    "",
    "Project Overview",
    "",
    buildProjectOverview(facts, collectedMemory),
    "",
    "Current Workflow Problem",
    "",
    ...facts.workflowProblems.map((item) => `* ${item}`),
    "",
    hasUploadedDocs ? "Workflow Findings from Document" : "Workflow Details Shared",
    "",
    facts.workflowDetails,
    "",
    "Business Goals",
    "",
    ...facts.goals.map((item) => `* ${item}`),
    "",
    "Recommended First Phase",
    "",
    ...buildFirstPhase(facts).map((item) => `* ${item}`),
    "",
    "Possible Later Phases",
    "",
    ...(facts.laterPhases.length ? facts.laterPhases : ["No later-phase scope has been confirmed yet."]).map((item) => `* ${item}`),
    "",
    "Information to Confirm During Discovery",
    "",
    ...openItems.map((item) => `* ${item}`),
    "",
    "Recommended Next Step",
    "",
    "Schedule a workflow scoping session with our sales and implementation teams to validate the first-phase scope and prepare a solution plan."
  ].join("\n");

  return applySectionReplacements(
    brief,
    parseStoredSectionReplacements(collectedMemory.brief_section_overrides)
  );
}

export function composeProjectBriefRevisionSections({
  userMessage,
  collectedMemory,
  recentConversation = ""
}: Omit<ComposeProjectBriefResponseInput, "conversationSummary" | "documentSources">) {
  collectedMemory = withMessageRejections(collectedMemory, userMessage);
  const context = [extractClientMessages(recentConversation), memoryFactText(collectedMemory)]
    .filter(Boolean)
    .join("\n");
  const facts = extractBriefFacts(collectedMemory, context, context);
  const requested = getRequestedSections(userMessage);
  const sections: string[] = [];

  const add = (title: string, lines: string[]) => {
    sections.push(title, "", ...lines, "");
  };

  if (requested.has("contact")) {
    add("Contact and Company Details", [
      `* Company: ${facts.company ?? UNKNOWN}`,
      `* Contact name: ${facts.contact ?? UNKNOWN}`,
      `* Contact role: ${facts.role ?? UNKNOWN}`,
      `* Email: ${facts.email ?? UNKNOWN}`
    ]);
  }
  if (requested.has("timeline")) add("Timeline", [facts.timeline ?? UNKNOWN]);
  if (requested.has("systems")) add("Systems Involved", facts.systems.map((item) => `* ${item}`));
  if (requested.has("overview")) add("Project Overview", [buildProjectOverview(facts, collectedMemory)]);
  if (requested.has("workflow_problem")) add("Current Workflow Problem", facts.workflowProblems.map((item) => `* ${item}`));
  if (requested.has("workflow_details")) add("Workflow Details Shared", [facts.workflowDetails]);
  if (requested.has("goals")) add("Business Goals", facts.goals.map((item) => `* ${item}`));
  if (requested.has("first_phase")) add("Recommended First Phase", buildFirstPhase(facts).map((item) => `* ${item}`));
  if (requested.has("later_phases")) {
    add("Possible Later Phases", (facts.laterPhases.length ? facts.laterPhases : ["No later-phase scope has been confirmed yet."]).map((item) => `* ${item}`));
  }
  if (requested.has("open_items")) add("Information to Confirm During Discovery", buildOpenItems(facts).map((item) => `* ${item}`));

  if (!sections.length) {
    add("Updated Project Brief Sections", [
      "The requested removals and product-neutral wording have been applied to the project brief."
    ]);
  }

  return sections.join("\n").trim();
}

export function extractBriefFacts(
  memory: RequirementMemory,
  fullContext: string,
  _workflowSourceText: string
): BriefFacts {
  const safeContext = removeRejectedSentences(fullContext, memory);
  const company = text(memory.company_name) ?? extractCompany(safeContext);
  const contact = text(memory.contact_name) ?? extractContact(safeContext);
  const role = text(memory.contact_role) ?? extractRole(safeContext);
  const email = text(memory.email) ?? safeContext.match(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i)?.[0] ?? null;
  const timeline = text(memory.timeline) ?? extractTimeline(safeContext);
  const systems = collectSystems(memory, safeContext);
  const workflowProblems = collectWorkflowProblems(memory, safeContext);
  const workflowDetails = buildWorkflowDetails(workflowProblems);
  const priorities = collectPriorities(memory, safeContext);
  const constraints = collectConstraints(memory, safeContext);
  const goals = collectGoals(safeContext, priorities);
  const laterPhases = collectLaterPhases(safeContext, memory);

  return {
    company,
    contact,
    role,
    email,
    timeline,
    systems,
    goals,
    workflowProblems,
    workflowDetails,
    priorities,
    constraints,
    laterPhases
  };
}

function extractClientMessages(conversation: string) {
  return conversation
    .split(/\n(?=(?:user|assistant):)/i)
    .filter((line) => /^user:/i.test(line.trim()))
    .map((line) => line.replace(/^user:\s*/i, "").trim())
    .join("\n");
}

function withMessageRejections(memory: RequirementMemory, message: string): RequirementMemory {
  const rejected = Array.from(new Set([
    ...getRejectedFacts(memory),
    ...extractRejectedFacts(message)
  ]));
  return rejected.length ? { ...memory, rejected_facts: rejected.join("|") } : memory;
}

function getRequestedSections(message: string) {
  const requested = new Set<string>();
  const sectionPatterns: Array<[string, RegExp]> = [
    ["contact", /contact and company|contact details?|company details?/i],
    ["timeline", /\btimeline\b/i],
    ["systems", /systems involved|systems section/i],
    ["overview", /project overview/i],
    ["workflow_problem", /current workflow problem/i],
    ["workflow_details", /workflow details(?: shared)?/i],
    ["goals", /business goals?/i],
    ["first_phase", /recommended first phase|first phase/i],
    ["later_phases", /possible later phases|later phases|moved to later/i],
    ["open_items", /information to confirm|open items/i]
  ];
  for (const [name, pattern] of sectionPatterns) {
    if (pattern.test(message)) requested.add(name);
  }
  return requested;
}

function memoryFactText(memory: RequirementMemory) {
  const factKeys = [
    "business_problem", "current_process", "teams_involved", "primary_bottleneck",
    "desired_outcome", "existing_systems", "constraints", "priority", "required_features",
    "company_name", "contact_name", "contact_role", "email", "timeline"
  ];
  return factKeys
    .map((key) => memory[key])
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join("\n");
}

function removeRejectedSentences(value: string, memory: RequirementMemory) {
  return value
    .split(/(?<=[.!?])\s+|\n/)
    .filter((sentence) => !textContainsRejectedFact(sentence, memory))
    .join("\n");
}

function collectSystems(memory: RequirementMemory, context: string) {
  const explicit = filterRejectedList(memory.existing_systems, memory);
  const source = `${explicit ?? ""}\n${context}`;
  const candidates: Array<[string, RegExp]> = [
    ["Encompass", /\bencompass\b/i],
    ["HubSpot", /\bhubspot\b/i],
    ["Salesforce", /\bsalesforce\b/i],
    ["Loan system", /\bloan system\b/i],
    ["CRM", /\bcrm\b/i],
    ["Borrower email/SMS tools", /\bborrower (?:email\/sms|email and sms)|\bemail\/sms tools\b/i]
  ];
  const systems = candidates
    .filter(([label, pattern]) => pattern.test(source) && !isRejectedLabel(label, memory))
    .map(([label]) => label);

  if (systems.includes("Encompass")) remove(systems, "Loan system");
  if (systems.includes("HubSpot") || systems.includes("Salesforce")) remove(systems, "CRM");
  return Array.from(new Set(systems));
}

function collectWorkflowProblems(memory: RequirementMemory, context: string) {
  const source = `${text(memory.current_process) ?? ""}\n${context}`;
  const problems: string[] = [];
  const usesNamedLoanSystem = /\bencompass\b/i.test(source) && !isRejectedLabel("Encompass", memory);
  const usesNamedCrm = /\bhubspot\b/i.test(source) && !isRejectedLabel("HubSpot", memory);
  const loanSystem = usesNamedLoanSystem ? "Encompass" : "the loan system";
  const crm = usesNamedCrm ? "HubSpot" : "the CRM";

  if (/loan status/i.test(source) && /manual|multiple places|duplicate/i.test(source)) {
    problems.push(`Loan status is updated in ${loanSystem} and then manually repeated in ${crm}.`);
  }
  if (/borrower/i.test(source) && /email|sms|updates?/i.test(source) && /manual/i.test(source)) {
    problems.push("Borrower email/SMS updates are sent manually after status changes.");
  }
  if (/manual handoffs?|rely on .*handoffs?/i.test(source)) {
    const teams = collectConfirmedTeams(memory, source);
    problems.push(teams.length
      ? `${humanList(teams)} rely on manual handoffs to remain informed.`
      : "Teams rely on manual handoffs to remain informed.");
  }
  if (/delays?|duplicate work|visibility gaps?/i.test(source)) {
    problems.push("The current process creates delays, duplicate work, and visibility gaps.");
  }

  return problems.length ? problems : [text(memory.current_process) ?? "Current workflow details will be validated during discovery."];
}

function collectConfirmedTeams(memory: RequirementMemory, context: string) {
  const source = `${text(memory.teams_involved) ?? ""}\n${context}`;
  return ["sales", "processing", "underwriting", "closing", "operations"]
    .filter((team) => new RegExp(`\\b${team}\\b`, "i").test(source));
}

function collectPriorities(memory: RequirementMemory, context: string) {
  const source = `${text(memory.priority) ?? ""}\n${text(memory.desired_outcome) ?? ""}\n${text(memory.goals) ?? ""}\n${text(memory.required_features) ?? ""}\n${context}`;
  const priorities: string[] = [];
  if (/crm status synchroni[sz]ation|keeping .*crm .*sync|keep .*crm .*aligned|hubspot .*sync/i.test(source)) {
    priorities.push("CRM status synchronization from the loan system");
  }
  if (/borrower .*automation|automat(?:e|ing) borrower|borrower email\/sms update automation/i.test(source)) {
    priorities.push("Borrower email/SMS update automation");
  }
  return priorities;
}

function collectConstraints(memory: RequirementMemory, context: string) {
  const source = `${text(memory.constraints) ?? ""}\n${context}`;
  const constraints: string[] = [];
  if (/security/i.test(source)) constraints.push("security");
  if (/compliance/i.test(source)) constraints.push("compliance");
  if (/access control/i.test(source)) constraints.push("access control");
  if (/audit visibility/i.test(source)) constraints.push("audit visibility");
  if (/avoid(?:ing)? disruption|without disrupt/i.test(source)) constraints.push("avoiding disruption to the existing workflow");
  return constraints;
}

function collectGoals(context: string, priorities: string[]) {
  const goals: string[] = [];
  if (/duplicate|multiple places|crm status synchroni[sz]ation/i.test(context)) {
    goals.push("Reduce duplicate status updates between the loan system and CRM.");
  }
  if (/visibility|manual handoffs?/i.test(context)) {
    goals.push("Improve status visibility across the teams involved in the workflow.");
  }
  if (/borrower/i.test(context) && /manual|automation|email|sms/i.test(context)) {
    goals.push("Reduce manual borrower email/SMS updates.");
  }
  if (/current|accurate|reliab|consistent|status information/i.test(context)) {
    goals.push("Improve the reliability and consistency of status information.");
  }
  if (!goals.length && priorities.length) {
    goals.push(...priorities.map((priority) => `Improve ${priority.toLowerCase()}.`));
  }
  return goals.length ? Array.from(new Set(goals)) : ["Confirm the desired business outcomes during discovery."];
}

function collectLaterPhases(context: string, memory: RequirementMemory) {
  const later: string[] = [];
  if (/internal visibility .*during discovery|review internal visibility .*discovery/i.test(context) && !isRejectedLabel("dashboard", memory)) {
    later.push("Additional internal visibility requirements, if confirmed during discovery.");
  }
  return later;
}

function buildWorkflowDetails(problems: string[]) {
  const processSteps = problems.filter((item) => !/creates delays|will be validated/i.test(item));
  return processSteps.join(" ");
}

function buildProjectOverview(facts: BriefFacts, memory: RequirementMemory) {
  const problem = text(memory.business_problem) ?? text(memory.project_overview) ?? facts.workflowProblems.join(" ");
  const priorityText = facts.priorities.length
    ? ` The confirmed priorities are ${humanList(facts.priorities)}.`
    : "";
  const constraintText = facts.constraints.length
    ? ` Discovery should treat ${humanList(facts.constraints)} as requirements.`
    : "";
  return `${problem}${priorityText}${constraintText}`.trim();
}

function buildFirstPhase(facts: BriefFacts) {
  if (!facts.priorities.length) {
    return ["Validate the first-phase priority during the workflow scoping session."];
  }
  return [
    ...facts.priorities.map((priority, index) => `${index + 1}. ${priority}.`),
    "Discovery will determine whether real-time, scheduled, or event-based synchronization is the best fit."
  ];
}

function buildOpenItems(facts: BriefFacts) {
  const items = [
    "Exact status fields, milestones, and update points.",
    "Borrower notification rules and triggers.",
    "Synchronization cadence and source-of-truth rules.",
    "Workflow ownership, security, access, and rollout requirements."
  ];
  if (!facts.company) items.push("Company name.");
  if (!facts.contact) items.push("Primary contact name and role.");
  if (!facts.email) items.push("Primary contact email address.");
  if (!facts.timeline) items.push("Target discovery timeline.");
  return items;
}

function extractCompany(value: string) {
  return value.match(/\bat\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/)?.[1]?.trim() ?? null;
}

function extractContact(value: string) {
  return value.match(/\bmain contact (?:would be|is|will be)\s+([A-Z][A-Za-z .'-]{1,60}?)(?:,|\s+at\s+|\.|\n|$)/i)?.[1]?.trim() ?? null;
}

function extractRole(value: string) {
  return value.match(/\bmain contact (?:would be|is|will be)\s+[A-Z][A-Za-z .'-]{1,60}?,\s*([^\n.]+?)(?=\s+at\s+[A-Z]|[.\n]|$)/i)?.[1]?.trim() ?? null;
}

function extractTimeline(value: string) {
  const match = value.match(/\b(?:start\s+)?discovery\s+within\s+(?:the\s+)?next\s+(\d+\s+weeks?|two\s+weeks?|three\s+weeks?|four\s+weeks?)\b/i);
  return match?.[1] ? `Start discovery within the next ${match[1]}` : null;
}

function isRejectedLabel(label: string, memory: RequirementMemory) {
  const rejected = getRejectedFacts(memory).map((item) => item.toLowerCase());
  return rejected.some((item) => label.toLowerCase().includes(item) || item.includes(label.toLowerCase()));
}

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean && clean !== "null" && clean !== "undefined" ? clean : null;
}

function remove(items: string[], value: string) {
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1);
}

function humanList(items: string[]) {
  if (items.length < 2) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

import type { DocumentSourceRow } from "@/lib/data/fileRepository";
import type { RequirementMemory } from "@/lib/data/requirementsRepository";

type ComposeProjectBriefResponseInput = {
  userMessage: string;
  collectedMemory: RequirementMemory;
  conversationSummary?: string;
  recentConversation?: string;
  documentSources?: DocumentSourceRow[];
};

type BriefFacts = {
  company: string | null;
  contact: string | null;
  email: string | null;
  timeline: string | null;
  systems: string[];
  goals: string[];
  workflowProblems: string[];
  documentFindings: string;
};

const UNKNOWN = "Not confirmed yet";

export function composeProjectBriefResponse({
  userMessage,
  collectedMemory,
  conversationSummary = "",
  recentConversation = "",
  documentSources = []
}: ComposeProjectBriefResponseInput) {
  const documentText = documentSources
    .map((source) => source.extracted_text)
    .filter(Boolean)
    .join("\n\n");
  const fullContext = [
    conversationSummary,
    recentConversation,
    documentText,
    userMessage,
    memoryText(collectedMemory)
  ]
    .filter(Boolean)
    .join("\n\n");
  const facts = extractBriefFacts(collectedMemory, fullContext, documentText || recentConversation);
  const genericMode = shouldKeepBriefGeneric(fullContext);
  const openItems = inferOpenItems(facts, collectedMemory);
  const hasUploadedDocs = documentSources.length > 0 || (recentConversation.toLowerCase().includes("workflow document") && (recentConversation.toLowerCase().includes("pasted") || recentConversation.toLowerCase().includes("uploaded")));

  return [
    "Official Project Brief for Our Sales and Implementation Teams",
    "",
    "Contact and Company Details",
    "",
    `* Company: ${facts.company ?? UNKNOWN}`,
    `* Contact: ${facts.contact ?? UNKNOWN}`,
    `* Email: ${facts.email ? formatEmail(facts.email) : UNKNOWN}`,
    "",
    "Timeline",
    "",
    facts.timeline ?? UNKNOWN,
    "",
    "Systems Involved",
    "",
    ...(genericMode ? getGenericSystems() : facts.systems).map((system) => `* ${system}`),
    "",
    "Project Overview",
    "",
    buildProjectOverview(facts),
    "",
    "Current Workflow Problem",
    "",
    ...facts.workflowProblems.map((item) => `* ${item}`),
    "",
    hasUploadedDocs ? "Workflow Findings from Document" : "Workflow Details Shared",
    "",
    hasUploadedDocs
      ? buildDocumentFindings(documentText || recentConversation)
      : `Based on the workflow details you described: ${facts.workflowProblems.join(", ")}.`,
    "",
    "Business Goals",
    "",
    ...facts.goals.map((goal) => `* ${goal}`),
    "",
    "Recommended First Phase",
    "",
    ...buildRecommendedFirstPhase(genericMode),
    "",
    "Possible Later Phases",
    "",
    ...buildLaterPhases(genericMode),
    "",
    "Information to Confirm During Discovery",
    "",
    ...(genericMode ? inferGenericOpenItems(facts, collectedMemory) : openItems).map((item) => `* ${item}`),
    "",
    "Recommended Next Step",
    "",
    "Schedule a workflow scoping session with our sales and implementation teams. We’ll review the project brief and workflow details before the scoping session to validate the first-phase scope and prepare a solution plan."
  ].join("\n");
}

export function extractBriefFacts(
  memory: RequirementMemory,
  fullContext: string,
  workflowSourceText: string
): BriefFacts {
  const company = firstString(memory.company_name) ?? extractCompany(fullContext);
  const contact = firstString(memory.contact_name) ?? extractContact(fullContext);
  const email = firstString(memory.email) ?? fullContext.match(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i)?.[0] ?? null;
  const timeline = firstString(memory.timeline) ?? extractTimeline(fullContext);
  const systems = collectSystems(memory, fullContext);
  const goals = collectGoals(memory, fullContext);
  const workflowProblems = collectWorkflowProblems(fullContext);
  const documentFindings = buildDocumentFindings(workflowSourceText || fullContext);

  return {
    company,
    contact,
    email,
    timeline,
    systems,
    goals,
    workflowProblems,
    documentFindings
  };
}

function memoryText(memory: RequirementMemory) {
  return Object.entries(memory)
    .filter(([, value]) => hasValue(value))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
}

function firstString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && trimmed !== "null" && trimmed !== "undefined" ? trimmed : null;
}

function hasValue(value: unknown) {
  return typeof value === "string" ? firstString(value) !== null : value !== null && value !== undefined;
}

function formatEmail(email: string) {
  return `[${email}](mailto:${email})`;
}

function extractCompany(text: string) {
  const patterns = [
    /\bCompany:\s*([^\n]+)/i,
    /\bat\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/,
    /\bcompany\s+(?:is|name is)\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/i
  ];

  return cleanExtracted(patterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean));
}

function extractContact(text: string) {
  const patterns = [
    /\bContact:\s*([^\n]+)/i,
    /\bmain contact will be\s+([^\n.]+)/i,
    /\bmain contact (?:would be|is)\s+([^,\n.]+)(?:,\s*([^.\n]+?)(?=\s+at\s+[A-Z]|[.\n]|$))?/i,
    /\bContact\s+and\s+Company\s+Details[\s\S]*?\*\s*Contact:\s*([^\n]+)/i
  ];

  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);
  if (!match) return null;
  const name = cleanExtracted(match[1]);
  const role = cleanExtracted(match[2]);
  return [name, role].filter(Boolean).join(", ") || null;
}

function extractTimeline(text: string) {
  const patterns = [
    /\bTimeline:\s*([^\n]+)/i,
    /\b(?:start\s+)?discovery\s+within\s+(?:the\s+)?next\s+(\d+\s+weeks?|two\s+weeks?|three\s+weeks?|four\s+weeks?)\b/i,
    /\bdiscovery\s+within\s+(?:the\s+)?next\s+(\d+\s+weeks?)/i,
    /\bwithin\s+(?:the\s+)?next\s+(\d+\s+weeks?)/i
  ];
  const match = patterns.map((pattern) => text.match(pattern)).find(Boolean);

  if (!match) {
    return null;
  }

  if (match[0].toLowerCase().includes("discovery")) {
    return cleanExtracted(match[0]);
  }

  const value = cleanExtracted(match[1]);
  if (match[0].toLowerCase().includes("discovery") && value && !value.toLowerCase().includes("discovery")) {
    return `Start discovery within the next ${value}`;
  }

  return value;
}

function cleanExtracted(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/\[([^\]]+)\]\(mailto:[^)]+\)/gi, "$1")
    .replace(/^[-*: ]+/, "")
    .replace(/[.。]$/, "")
    .trim() || null;
}

function collectSystems(memory: RequirementMemory, text: string) {
  if (shouldKeepBriefGeneric(text)) {
    return getGenericSystems();
  }

  const base: Array<[string, RegExp]> = [
    ["Encompass", /\bencompass\b/i],
    ["HubSpot", /\bhubspot\b/i],
    ["Title vendor system", /\btitle\b/i],
    ["Appraisal vendor system", /\bappraisal\b/i],
    ["Borrower email/SMS communication tools", /\bborrower\b|\bemail\/sms\b|\bsms\b/i]
  ];
  const memorySystems = [memory.existing_systems, memory.integration_requirements, memory.existing_tools]
    .map(firstString)
    .filter(Boolean)
    .join("; ");
  const combined = `${text}\n${memorySystems}`;
  const systems = base.filter(([, pattern]) => pattern.test(combined)).map(([label]) => label);

  return systems.length > 0 ? systems : ["Systems to confirm during discovery"];
}

function collectGoals(memory: RequirementMemory, text: string) {
  const explicitGoals = firstString(memory.goals);
  const combined = `${text}\n${explicitGoals ?? ""}`;
  const genericMode = shouldKeepBriefGeneric(combined);
  const goals = ([
    [genericMode ? "Reduce duplicate status updates between the loan system and CRM." : "Reduce duplicate data entry between Encompass and HubSpot.", /reduce duplicate|duplicate data entry|duplicate entry|duplicate updates/i],
    ["Improve visibility for processing, underwriting, and closing teams.", /visibility|processing|underwriting|closing/i],
    ["Automate borrower status notifications.", /borrower.*notification|status notification|email\/sms/i],
    ["Reduce manual follow-ups with title and appraisal vendors.", /vendor follow-up|title.*appraisal|manual follow/i],
    ["Avoid adding more operations staff as loan volume grows.", /avoid adding|operations staff|volume grows/i]
  ] as Array<[string, RegExp]>)
    .filter(([, pattern]) => pattern.test(combined))
    .map(([goal]) => goal);

  return goals.length > 0 ? goals : ["Confirm business goals during discovery."];
}

function collectWorkflowProblems(text: string) {
  if (shouldKeepBriefGeneric(text)) {
    const problems = ([
      ["Loan status is updated in the loan system and then manually repeated in the CRM.", /loan status|crm|loan system|manual/i],
      ["Borrower email/SMS updates are sent manually.", /borrower.*manual|manual email|manual sms|email\/sms/i],
      ["Teams rely on manual handoffs to stay aligned.", /handoff|handoffs/i],
      ["Vendor follow-up processes for title and appraisal may need later-phase review.", /title|appraisal|vendor/i]
    ] as Array<[string, RegExp]>)
      .filter(([, pattern]) => pattern.test(text))
      .map(([problem]) => problem);

    return problems.length > 0
      ? problems
      : ["Current workflow details should be confirmed during discovery."];
  }

  const problems = ([
    ["Processor updates loan status in Encompass.", /processor.*loan status.*encompass|loan status.*encompass/i],
    ["The same status is manually updated in HubSpot.", /same status.*hubspot|manually updated in hubspot|hubspot update/i],
    ["Borrower email/SMS updates are sent manually.", /borrower.*manual|manual email|manual sms|email\/sms/i],
    ["Title vendor is contacted manually when loan status changes.", /title vendor.*manual|title.*status changes/i],
    ["Appraisal vendor follow-up is tracked separately.", /appraisal.*tracked separately|appraisal vendor/i],
    ["Processing, underwriting, and closing teams do not have one shared loan-status view.", /processing.*underwriting.*closing|shared status view|shared loan-status view/i]
  ] as Array<[string, RegExp]>)
    .filter(([, pattern]) => pattern.test(text))
    .map(([problem]) => problem);

  return problems.length > 0
    ? problems
    : ["Current workflow details should be confirmed during discovery."];
}

function buildDocumentFindings(text: string) {
  const findings = [
    /same status.*hubspot|duplicated fields|duplicate manual/i.test(text)
      ? "the same loan status information is manually repeated across multiple systems"
      : null,
    /borrower.*notification|email\/sms|manual email|manual sms/i.test(text)
      ? "borrower notification triggers"
      : null,
    /title|appraisal|vendor/i.test(text)
      ? "vendor follow-up coordination"
      : null,
    /processing.*underwriting.*closing|shared status view|shared loan-status view/i.test(text)
      ? "shared visibility across internal teams"
      : null
  ].filter(Boolean) as string[];

  if (findings.length === 0) {
    return "The workflow document should be reviewed during discovery to confirm workflow steps, system update points, notification triggers, duplicated fields, and manual handoffs.";
  }

  return `The workflow document shows that ${findings[0]}. The strongest operational gaps are ${humanList(findings.slice(1).length > 0 ? findings.slice(1) : findings)}.`;
}

function buildProjectOverview(facts: BriefFacts) {
  const company = facts.company ?? "The client";
  const systems = facts.systems.filter((system) => system !== "Systems to confirm during discovery");
  const systemText = systems.length > 0 ? ` across ${humanList(systems)}` : "";

  return `${company} is looking to reduce duplicate manual work${systemText}. The confirmed first priority is CRM status synchronization from the loan system, followed by borrower email/SMS update automation. Vendor follow-ups for title and appraisal should remain a possible later phase unless discovery confirms they should be included earlier.`;
}

function shouldKeepBriefGeneric(text: string) {
  return /\b(keep (?:the )?(?:wording|system names) generic|specific systems .* not confirmed|not confirmed .* specific systems|have not confirmed .*(?:encompass|hubspot|plugin)|avoid assuming specific products|avoid assuming .*plugins|avoid assuming .*real-time|do not assume .*real-time|loan system, crm|our loan system, crm)\b/i.test(
    text
  );
}

function getGenericSystems() {
  return [
    "Loan system",
    "CRM",
    "Borrower email/SMS tools",
    "Manual vendor follow-up processes"
  ];
}

function buildRecommendedFirstPhase(genericMode: boolean) {
  if (genericMode) {
    return [
      "* CRM status synchronization from the loan system as the first priority.",
      "* Borrower email/SMS update automation as the second priority.",
      "* Confirm during discovery whether synchronization should be real-time, scheduled, or event-based."
    ];
  }

  return [
    "* Map Encompass loan status fields to HubSpot update points.",
    "* Define source-of-truth rules for loan status updates.",
    "* Identify borrower notification triggers.",
    "* Define shared visibility requirements for processing, underwriting, and closing teams.",
    "* Confirm whether automation should be scheduled, event-driven, or real-time depending on system capabilities."
  ];
}

function buildLaterPhases(genericMode: boolean) {
  if (genericMode) {
    return [
      "* Title and appraisal vendor follow-up automation.",
      "* Additional internal visibility workflows if needed after discovery.",
      "* Broader reporting or dashboard needs if the first phase shows a clear requirement."
    ];
  }

  return [
    "* Borrower notification automation.",
    "* Vendor coordination automation.",
    "* Operational visibility dashboard.",
    "* Custom Encompass plugin for specific workflow actions.",
    "* Internal operations portal if teams need centralized status visibility beyond CRM/LOS synchronization."
  ];
}

function inferGenericOpenItems(facts: BriefFacts, memory: RequirementMemory) {
  const open = [
    "Exact loan-status fields and milestones involved.",
    "CRM objects, properties, and update points.",
    "Borrower communication rules and message triggers.",
    "Whether synchronization should be real-time, scheduled, or event-based.",
    "Vendor follow-up steps and whether they belong in a later phase.",
    "Which team owns each workflow stage.",
    "Security, compliance, audit visibility, and access requirements.",
    "Preferred implementation priority and rollout approach."
  ];

  if (!hasValue(memory.inquiry_volume)) open.push("Approximate loan volume or status-update volume.");
  if (!hasValue(memory.team_size)) open.push("Number of team members involved in the manual process.");
  if (!hasValue(memory.budget_range)) open.push("Target budget range for this project.");
  if (!facts.company) open.push("Company legal name and account ownership details.");
  if (!facts.contact) open.push("Primary contact name and role.");
  if (!facts.email) open.push("Primary contact email address.");
  if (!facts.timeline) open.push("Target discovery and rollout timeline.");

  return open;
}

function inferOpenItems(facts: BriefFacts, memory: RequirementMemory) {
  const open = [
    "Exact Encompass fields and milestones involved.",
    "HubSpot objects, properties, and update points.",
    "Borrower communication rules and message triggers.",
    "Vendor follow-up steps and system access requirements.",
    "Which team owns each workflow stage.",
    "Required reporting and visibility views.",
    "Security, compliance, and access requirements.",
    "Preferred implementation priority and rollout approach."
  ];

  if (!hasValue(memory.inquiry_volume)) {
    open.push("Approximate loan volume (daily or weekly status-related requests).");
  }
  if (!hasValue(memory.team_size)) {
    open.push("Number of team members/processors involved in the manual process.");
  }
  if (!hasValue(memory.budget_range)) {
    open.push("Target budget range for this project.");
  }
  if (!hasValue(memory.traffic_volume)) {
    open.push("Monthly website traffic volume (if borrower self-service pages are involved).");
  }
  if (!hasValue(memory.conversion_metrics)) {
    open.push("Specific conversion, lead, or operational metrics to improve.");
  }

  if (!facts.company) open.push("Company legal name and account ownership details.");
  if (!facts.contact) open.push("Primary contact name and role.");
  if (!facts.email) open.push("Primary contact email address.");
  if (!facts.timeline) open.push("Target discovery and rollout timeline.");

  return open;
}

function humanList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

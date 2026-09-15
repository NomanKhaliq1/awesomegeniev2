import type { RequirementMemory } from "@/lib/data/requirementsRepository";

export type DiscoveryField = {
  key: string;
  label: string;
  question: string;
  weight: number;
  priority: "high" | "medium" | "low";
};

function hasValue(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
  }

  return value !== undefined && value !== null;
}

function getMemoryText(memory?: RequirementMemory): string {
  if (!memory) return "";

  return [
    memory.industry,
    memory.service_type,
    memory.project_overview,
    memory.business_problem,
    memory.goals,
    memory.pain_points,
    memory.existing_systems,
    memory.support_workload,
    memory.required_features,
    memory.latest_project_note,
    memory.channels
  ]
    .filter(hasValue)
    .map((value) => String(value).toLowerCase())
    .join(" ");
}

export const discoveryFields: DiscoveryField[] = [
  {
    key: "goals",
    label: "Business goals",
    question: "What are the primary business goals or outcomes you want to achieve?",
    weight: 12,
    priority: "high"
  },
  {
    key: "pain_points",
    label: "Pain points",
    question: "What specific pain points or bottlenecks are you trying to solve?",
    weight: 12,
    priority: "high"
  },
  {
    key: "business_problem",
    label: "Business problem",
    question: "What core business problem are you trying to solve?",
    weight: 12,
    priority: "high"
  },
  {
    key: "project_overview",
    label: "Project overview",
    question: "Can you share a short overview of what you want to build or improve?",
    weight: 12,
    priority: "high"
  },
  {
    key: "existing_systems",
    label: "Existing systems & integrations",
    question: "What systems, platforms, CRMs, LOS tools, or vendor systems are involved?",
    weight: 12,
    priority: "high"
  },
  {
    key: "support_workload",
    label: "Support or operations workload",
    question: "How much time or effort does your team currently spend on this manual process?",
    weight: 10,
    priority: "high"
  },
  {
    key: "inquiry_volume",
    label: "Inquiry volume",
    question: "Approximately how many inquiries or support requests do you receive daily or weekly?",
    weight: 6,
    priority: "medium"
  },
  {
    key: "traffic_volume",
    label: "Website traffic",
    question: "How much traffic does your company website get monthly?",
    weight: 6,
    priority: "medium"
  },
  {
    key: "industry",
    label: "Industry sector",
    question: "What industry is your company in?",
    weight: 6,
    priority: "medium"
  },
  {
    key: "client_services",
    label: "Company services",
    question: "What core products or services does your company offer?",
    weight: 4,
    priority: "medium"
  },
  {
    key: "channels",
    label: "Communication channels",
    question: "Which communication channels are involved?",
    weight: 4,
    priority: "medium"
  },
  {
    key: "conversion_metrics",
    label: "Conversion metrics",
    question: "What conversion, lead, or operational metric are you trying to improve?",
    weight: 4,
    priority: "low"
  }
];

export function detectMortgageDomain(memory?: RequirementMemory): boolean {
  const text = getMemoryText(memory);

  const mortgageKeywords = [
    "mortgage",
    "encompass",
    "lending",
    "loan",
    "borrower",
    "underwriter",
    "underwriting",
    "processor",
    "processing",
    "closing",
    "title",
    "appraisal",
    "los",
    "hubspot",
    "vendor system",
    "vendor systems",
    "loan lifecycle",
    "status update",
    "status updates"
  ];

  return mortgageKeywords.some((keyword) => text.includes(keyword));
}

function calculateBusinessConfidenceScore(memory: RequirementMemory): number {
  let score = 0;

  const text = getMemoryText(memory);

  if (hasValue(memory.goals)) score += 14;
  if (hasValue(memory.pain_points)) score += 14;
  if (hasValue(memory.business_problem)) score += 14;
  if (hasValue(memory.project_overview)) score += 10;
  if (hasValue(memory.existing_systems)) score += 16;
  if (hasValue(memory.support_workload)) score += 10;
  if (hasValue(memory.industry)) score += 6;
  if (hasValue(memory.channels)) score += 4;
  if (hasValue(memory.required_features)) score += 4;
  if (hasValue(memory.inquiry_volume)) score += 4;
  if (hasValue(memory.client_services)) score += 2;
  if (hasValue(memory.conversion_metrics)) score += 2;

  const systemsMentioned = [
    "crm",
    "erp",
    "los",
    "systems",
    "software",
    "platform",
    "platforms",
    "tools",
    "database",
    "api",
    "apis",
    "integration",
    "sync",
    "hubspot",
    "encompass",
    "shopify",
    "salesforce",
    "jira",
    "vendor",
    "third-party",
    "third party",
    "spreadsheet",
    "excel"
  ].some((keyword) => text.includes(keyword));

  const lifecycleMentioned = [
    "intake",
    "application",
    "processing",
    "underwriting",
    "closing",
    "funding",
    "lifecycle",
    "stages",
    "milestone",
    "milestones",
    "pipeline",
    "step",
    "steps",
    "flow",
    "workflow",
    "process",
    "phase",
    "phases"
  ].some((keyword) => text.includes(keyword));

  const manualTouchpointsMentioned = [
    "manual",
    "manually",
    "status",
    "statuses",
    "notify",
    "notification",
    "notifications",
    "coordinate",
    "coordination",
    "duplicate",
    "double entry",
    "data entry",
    "copying",
    "pasting",
    "email",
    "emails",
    "delay",
    "delays",
    "moving info",
    "moving information"
  ].some((keyword) => text.includes(keyword));

  const scalabilityMentioned = [
    "scale",
    "scalable",
    "scalability",
    "volume",
    "capacity",
    "growth",
    "efficiency",
    "headcount",
    "hiring",
    "cost",
    "time",
    "speed",
    "faster"
  ].some((keyword) => text.includes(keyword));

  if (systemsMentioned) score += 6;
  if (lifecycleMentioned) score += 6;
  if (manualTouchpointsMentioned) score += 6;
  if (scalabilityMentioned) score += 4;

  return Math.min(score, 100);
}

export function calculateConfidenceScore(memory: RequirementMemory): number {
  return calculateBusinessConfidenceScore(memory);
}

export function getConfidenceLevel(score: number): string {
  if (score <= 40) {
    return "Discovery Required";
  }

  if (score <= 70) {
    return "Partial Understanding";
  }

  if (score <= 84) {
    return "Near Recommendation Ready";
  }

  if (score <= 89) {
    return "Recommendation Ready";
  }

  return "Generate Project Brief";
}
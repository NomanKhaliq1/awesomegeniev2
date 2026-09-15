import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getLangChainStructuredModel } from "@/lib/langchain/model";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";
import { z } from "zod";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/;

const servicePatterns = [
  {
    service: "Business Automation",
    patterns: ["automation", "automate", "workflow", "manual steps", "process", "streamline"]
  },
  {
    service: "Website Development",
    patterns: ["website", "portal", "landing page", "web site", "frontend"]
  },
  {
    service: "Systems Integration",
    patterns: ["integration", "integrate", "api", "connect", "synchronize", "sync"]
  },
  {
    service: "Reporting & Analytics",
    patterns: ["dashboard", "reporting", "kpi", "analytics", "power bi", "chart"]
  },
  {
    service: "Custom Software",
    patterns: ["software", "application", "app", "custom tool", "system"]
  },
  {
    service: "CRM Development",
    patterns: ["crm", "customer relationship", "hubspot", "salesforce"]
  }
];

// Zod Schema for Lead Requirement Extraction
const RequirementMemorySchema = z.object({
  contact_name: z.string().nullable().optional().describe("Name of the contact person."),
  company_name: z.string().nullable().optional().describe("Name of the company or business."),
  email: z.string().nullable().optional().describe("A valid email address."),
  phone: z.coerce.string().nullable().optional().describe("A phone or contact number."),
  country_location: z.string().nullable().optional().describe("Country or location of the business."),
  service_type: z.string().nullable().optional().describe("The service matching this request."),
  project_overview: z.string().nullable().optional().describe("Brief project description."),
  business_problem: z.string().nullable().optional().describe("The business problem they want to solve."),
  budget_range: z.coerce.string().nullable().optional().describe("The budget range in mind."),
  timeline: z.coerce.string().nullable().optional().describe("The target project delivery timeline."),
  required_features: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("Features or integration capabilities requested."),

  // New Discovery fields
  goals: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("The primary business goals or outcomes they want to achieve."),
  pain_points: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("The customer or team pain points and bottlenecks."),
  current_process: z.string().nullable().optional().describe("How the process/workflow operates today."),
  teams_involved: z.string().nullable().optional().describe("The teams, roles, or departments involved in this process."),
  primary_bottleneck: z.string().nullable().optional().describe("Where the process usually slows down, gets stuck, or experiences delays/friction."),
  desired_outcome: z.string().nullable().optional().describe("What the client wants to be different if the process worked exactly as they'd like it to."),
  inquiry_volume: z.coerce.string().nullable().optional().describe("The volume or frequency of client inquiries received, or loan volume, transactions, or monthly volume."),
  traffic_volume: z.coerce.string().nullable().optional().describe("The average web traffic volume (visitors per month)."),
  support_workload: z.coerce.string().nullable().optional().describe("The workload, time, or cost spent on manual support."),
  existing_systems: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("The existing CRMs, CMS, or databases in use."),
  existing_tools: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("Legacy key for tools/systems currently in use."),
  integration_requirements: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("Legacy key for systems/integrations required."),
  industry: z.string().nullable().optional().describe("The industry sector or domain they specialize in."),
  client_services: z.string().nullable().optional().describe("The core products or services they offer to their clients."),
  channels: z.union([z.string(), z.array(z.string())]).nullable().optional().describe("The communication channels customers use to contact them."),
  conversion_metrics: z.coerce.string().nullable().optional().describe("The current or target visitor-to-lead conversion rates."),
  team_size: z.coerce.string().nullable().optional().describe("The size of their customer support or sales team.")
});

type ExtractRequirementMemoryOptions = {
  useSlm?: boolean;
};

// Enterprise Validation function
export function validateRequirementMemory(extracted: RequirementMemory): { sanitized: RequirementMemory, alerts: string[] } {
  const sanitized: RequirementMemory = { ...extracted };
  const alerts: string[] = [];

  if (extracted.email) {
    const emailStr = String(extracted.email).trim();
    if (!emailPattern.test(emailStr)) {
      alerts.push("Please provide a valid email address.");
      delete sanitized.email;
    }
  }

  if (extracted.phone) {
    const phoneStr = String(extracted.phone).trim();
    const numericStr = phoneStr.replace(/\D/g, "");
    if (numericStr.length < 7 || !phonePattern.test(phoneStr)) {
      alerts.push("Please provide a valid phone number (at least 7 digits).");
      delete sanitized.phone;
    }
  }

  return { sanitized, alerts };
}

export async function extractRequirementMemory(
  message: string,
  { useSlm = true }: ExtractRequirementMemoryOptions = {}
): Promise<RequirementMemory> {
  if (!useSlm) {
    return extractRequirementMemoryFallback(message);
  }

  try {
    const structuredModel = getLangChainStructuredModel(RequirementMemorySchema, { useSlm: true });

    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("extract_memory.system"),
      getPromptTemplate("extract_memory.user")
    ]);

    const renderedUser = renderTemplate(userTemplate, { message });

    const result = await structuredModel.invoke([
      { role: "system", content: system + "\nResponse must be a valid JSON object." },
      { role: "user", content: renderedUser }
    ]);

    if (result) {
      // Format properties matching database keys
      const mappedResult: RequirementMemory = {};
      const fields = Object.keys(result) as string[];
      for (const field of fields) {
        const val = (result as any)[field];
        if (val !== undefined && val !== null) {
          if (Array.isArray(val)) {
            mappedResult[field] = val.filter((item) => typeof item === "string" && item.trim().length > 0).join(", ");
          } else {
            mappedResult[field] = val;
          }
        }
      }

      // Merge legacy/alternative keys into existing_systems
      const systemsList: string[] = [];
      if (mappedResult.existing_systems) systemsList.push(String(mappedResult.existing_systems));
      if (mappedResult.existing_tools) systemsList.push(String(mappedResult.existing_tools));
      if (mappedResult.integration_requirements) systemsList.push(String(mappedResult.integration_requirements));
      if (systemsList.length > 0) {
        mappedResult.existing_systems = systemsList.join("; ");
        delete mappedResult.existing_tools;
        delete mappedResult.integration_requirements;
      }

      return sanitizeExtractedMemory(
        message,
        removeNullishValues({
          latest_project_note: message,
          ...removeNullishValues(mappedResult),
          ...extractDeterministicFields(message)
        })
      );
    }
  } catch (error) {
    console.error("LangChain extractRequirementMemory failed, using fallback:", error);
  }

  return extractRequirementMemoryFallback(message);
}

export function extractRequirementMemoryFallback(message: string): RequirementMemory {
  const deterministicFields = extractDeterministicFields(message);
  const normalizedMessage = message.toLowerCase();
  const memory: RequirementMemory = {
    latest_project_note: message,
    ...deterministicFields
  };

  const serviceType = hasExplicitServiceSelection(message)
    ? servicePatterns.find((candidate) =>
        candidate.patterns.some((pattern) => normalizedMessage.includes(pattern))
      )?.service
    : null;

  if (serviceType) {
    memory.service_type = serviceType;
  }

  const companyMatch = message.match(
    /(?:company|business|firm|organization|organisation)\s+(?:is|name is|:)?\s*([A-Z0-9][A-Z0-9 &,'-]{1,80}?)(?:\.|,|\n|$)/i
  );

  if (companyMatch?.[1]) {
    const name = companyMatch[1].trim().replace(/[.。]$/, "");
    const lowercaseName = name.toLowerCase();
    const blacklisted = ["website", "app", "portal", "software", "system", "database", "service", "product"];
    if (!blacklisted.some(word => lowercaseName.includes(word))) {
      memory.company_name = name;
    }
  }

  const timelineMatch = message.match(
    /\b(?:timeline|within|in|by)\s+([0-9]+\s*(?:days?|weeks?|months?)|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december)\b/i
  );

  if (timelineMatch?.[1]) {
    memory.timeline = timelineMatch[1];
  }

  const budgetMatch = message.match(
    /\b(?:budget|around|range)\s*(?:is|:)?\s*(\$?\d+[kKmM]?(?:\s*-\s*\$?\d+[kKmM]?)?)/i
  );

  if (budgetMatch?.[1]) {
    memory.budget_range = budgetMatch[1];
  }

  if (message.trim().length > 24) {
    memory.project_overview = message.trim();
  }

  return sanitizeExtractedMemory(message, memory);
}

function extractDeterministicFields(message: string): RequirementMemory {
  const memory: RequirementMemory = {};
  const email = message.match(emailPattern)?.[0];
  const phone = message.match(phonePattern)?.[0];
  const contactName = extractContactName(message);
  const contactRole = extractContactRole(message);
  const companyName = extractCompanyName(message);
  const timeline = extractTimeline(message);
  const countryLocation = extractCountryLocation(message);

  if (email) {
    memory.email = email;
  }

  if (phone) {
    memory.phone = phone;
  }

  if (contactName) {
    memory.contact_name = contactName;
  }

  if (contactRole) {
    memory.contact_role = contactRole;
  }

  if (companyName) {
    memory.company_name = companyName;
  }

  if (timeline) {
    memory.timeline = timeline;
  }

  if (countryLocation) {
    memory.country_location = countryLocation;
  }

  const volumeMatch = message.match(
    /\b(?:process|handling|around|about|approx|approximately)?\s*(\d+\s*(?:loans?|inquiries?|requests?|transactions?|tickets?)\s*(?:per\s*month|per\s*day|per\s*week|\/month|\/day|\/week|monthly|daily|weekly|a\s*month|a\s*day|a\s*week))\b/i
  );
  if (volumeMatch?.[1]) {
    memory.inquiry_volume = volumeMatch[1].trim();
  }

  const teamSizeMatch = message.match(
    /\b(?:team\s*(?:size\s*(?:of|is)?)?\s*(\d+)|(\d+)\s*(?:processors?|agents?|team\s*members?|users?|staff))\b/i
  );
  if (teamSizeMatch) {
    const size = teamSizeMatch[1] || teamSizeMatch[2];
    if (size) {
      memory.team_size = size.trim();
    }
  }

  const teamsInvolved = extractTeamsInvolved(message);
  if (teamsInvolved) {
    memory.teams_involved = teamsInvolved;
  }

  if (looksLikeBottleneckAnswer(message)) {
    memory.primary_bottleneck = message.trim();
  }

  const currentProcess = extractCurrentProcess(message);
  if (currentProcess) {
    memory.current_process = currentProcess;
  }

  const existingSystems = extractExistingSystems(message);
  if (existingSystems) {
    memory.existing_systems = existingSystems;
  }

  const desiredOutcome = extractDesiredOutcome(message);
  if (desiredOutcome) {
    memory.desired_outcome = desiredOutcome;
    memory.goals = memory.goals ?? desiredOutcome;
  }

  const channels = extractChannels(message);
  if (channels) {
    memory.channels = channels;
  }

  const requiredFeatures = extractRequiredFeatures(message);
  if (requiredFeatures) {
    memory.required_features = requiredFeatures;
  }

  if (/\b(mortgage|loan operations?|loan status|borrower|lending)\b/i.test(message)) {
    memory.industry = "Mortgage lending";
  }

  const operationalMetrics = extractOperationalMetrics(message);
  if (operationalMetrics) {
    memory.conversion_metrics = operationalMetrics;
  }

  if (hasExplicitServiceSelection(message)) {
    if (/\b(integration|synchronization|sync)\b/i.test(message)) {
      memory.service_type = memory.service_type ?? "Systems Integration";
    } else if (/\b(automation|workflow)\b/i.test(message)) {
      memory.service_type = memory.service_type ?? "Business Automation";
    }
  }

  return memory;
}

function extractCurrentProcess(message: string) {
  const normalized = message.toLowerCase();
  const hasStepwiseWorkflow =
    /\b(first|after that|then|right now|currently|workflow is already|current workflow)\b/i.test(normalized) &&
    /\b(loan status|crm|loan system|borrower|email\/sms|handoffs?|updates?)\b/i.test(normalized);

  if (!hasStepwiseWorkflow) {
    return null;
  }

  return message.trim();
}

function extractExistingSystems(message: string) {
  const normalized = message.toLowerCase();
  const systems: string[] = [];

  if (/\b(?:remove|exclude|omit|not confirmed|not shared|do not include|don'?t include|do not assume|don'?t assume|keep .* generic)\b/i.test(normalized)) {
    return null;
  }

  if (/\bloan system\b/i.test(normalized)) systems.push("Loan system");
  if (/\bcrm\b/i.test(normalized)) systems.push("CRM");
  if (/\bborrower email\/sms tools\b|\bemail\/sms tools\b|\bborrower email\/sms\b|\bemail\/sms\b/i.test(normalized)) {
    systems.push("Borrower email/SMS tools");
  }
  if (/\bmanual vendor follow-up processes\b|\bvendor follow-up\b|\btitle\b|\bappraisal\b/i.test(normalized)) {
    systems.push("Manual vendor follow-up processes");
  }
  if (/\bencompass\b/i.test(normalized)) systems.push("Encompass");
  if (/\bhubspot\b/i.test(normalized)) systems.push("HubSpot");

  return systems.length > 0 ? Array.from(new Set(systems)).join(", ") : null;
}

function extractDesiredOutcome(message: string) {
  const normalized = message.toLowerCase();
  const outcomes: string[] = [];

  if (/\bcrm status synchronization\b|\bkeeping the crm aligned\b|\bcrm aligned\b|\bcrm status sync\b/i.test(normalized)) {
    outcomes.push("CRM status synchronization from the loan system");
  }
  if (/\bborrower email\/sms update automation\b|\bborrower update automation\b|\bautomating borrower updates\b|\bborrower email\/sms updates?\b/i.test(normalized)) {
    outcomes.push("Borrower email/SMS update automation");
  }
  if (/\bvisibility\b|\binternal visibility\b/i.test(normalized)) {
    outcomes.push("Improved internal visibility");
  }
  if (/\breduce duplicate\b|\bduplicate work\b|\bduplicate updates\b/i.test(normalized)) {
    outcomes.push("Reduced duplicate updates");
  }
  if (/\bsecurity\b|\baccess control\b|\baudit visibility\b|\bcompliance\b|\bborrower communication reliability\b/i.test(normalized)) {
    outcomes.push("Security, access control, audit visibility, and reliable borrower communication");
  }

  return outcomes.length > 0 ? Array.from(new Set(outcomes)).join("; ") : null;
}

function extractChannels(message: string) {
  const channels: string[] = [];
  if (/\bemail\/sms\b|\bemail\b|\bsms\b/i.test(message)) channels.push("Email/SMS");
  if (/\bmanual handoffs?\b/i.test(message)) channels.push("Manual handoffs");
  if (/\bcrm\b/i.test(message)) channels.push("CRM");
  return channels.length > 0 ? Array.from(new Set(channels)).join(", ") : null;
}

function extractRequiredFeatures(message: string) {
  const features: string[] = [];
  if (/\bcrm status synchronization\b|\bcrm .*sync/i.test(message)) {
    features.push("CRM status synchronization from the loan system");
  }
  if (/\bborrower email\/sms update automation\b|\bborrower.*automation\b/i.test(message)) {
    features.push("Borrower email/SMS update automation");
  }
  if (/\bsecurity\b|\baccess control\b|\baudit visibility\b|\bcompliance\b/i.test(message)) {
    features.push("Security, access control, audit visibility, and compliance considerations");
  }
  return features.length > 0 ? Array.from(new Set(features)).join("; ") : null;
}

function extractOperationalMetrics(message: string) {
  const metrics: string[] = [];
  if (/\bdelays?|response time|processing time|turnaround time\b/i.test(message)) {
    metrics.push("Reduce workflow delays");
  }
  if (/\bduplicate work|duplicate updates?|repeated data entry|redundant data entry\b/i.test(message)) {
    metrics.push("Reduce duplicate work");
  }
  if (/\bvisibility gaps?|improve visibility|internal visibility\b/i.test(message)) {
    metrics.push("Improve operational visibility");
  }

  return metrics.length > 0 ? Array.from(new Set(metrics)).join("; ") : null;
}

function hasExplicitServiceSelection(message: string) {
  if (/\b(whether|trying to understand whether|not sure (?:whether|if)|do we need)\b/i.test(message)) {
    return false;
  }

  return /\b(?:we|i)\s+(?:need|want|require|selected|chose|have chosen|are looking for)\s+(?:an?\s+|some\s+)?(?:[a-z0-9-]+\s+){0,3}(?:systems?\s+integration|integration|automation|workflow automation|website development|custom software|crm development|reporting|analytics)\b/i.test(
    message
  ) || /\bservice type\s+(?:is|:)\s*/i.test(message);
}

function looksLikeBottleneckAnswer(message: string) {
  const normalized = message.toLowerCase();
  const hasDelaySignal =
    /\b(biggest delays?|delays?|delayed|slow(?:s|ed|ing)?|slowdown|stuck|bottleneck|friction|wait(?:s|ing)?|missing|outdated|not updated|has not yet updated|not yet updated|responded to an email|respond to an email)\b/i.test(
      normalized
    );
  const hasWorkflowSignal =
    /\b(process|workflow|support|operations|team|teams|customer|request|update|spreadsheet|email|status|information|responding|manual)\b/i.test(
      normalized
    );

  return hasDelaySignal && hasWorkflowSignal;
}

function extractTeamsInvolved(message: string) {
  const normalized = message.toLowerCase();
  const teamMap: Array<[string, string]> = [
    ["customer support", "customer support"],
    ["support team", "customer support"],
    ["operations", "operations"],
    ["operations team", "operations"],
    ["management", "management"],
    ["sales", "sales"],
    ["finance", "finance"],
    ["accounting", "accounting"],
    ["admin", "admin"],
    ["administration", "administration"],
    ["hr", "HR"],
    ["human resources", "HR"],
    ["it team", "IT"],
    ["engineering", "engineering"],
    ["development team", "development"],
    ["delivery team", "delivery"],
    ["implementation team", "implementation"],
    ["processing", "processing"],
    ["processors", "processing"],
    ["underwriting", "underwriting"],
    ["closing", "closing"],
    ["marketing", "marketing"],
    ["leadership", "leadership"],
    ["managers", "management"],
    ["supervisors", "supervisors"],
    ["agents", "agents"],
    ["representatives", "representatives"]
  ];
  const teams = new Set<string>();

  for (const [term, label] of teamMap) {
    if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(normalized)) {
      teams.add(label);
    }
  }

  if (
    teams.size < 2 &&
    !/\b(main teams involved|teams involved|roles involved|departments involved)\b/i.test(normalized)
  ) {
    return null;
  }

  return Array.from(teams).join(", ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractContactName(message: string) {
  const mainContactMatch = message.match(
    /\bmain contact (?:would be|is)\s+([A-Z][A-Za-z .'-]{1,60}?)(?=,\s*(?:Director|Manager|Head|VP|Vice President|Lead|Owner|CEO|CTO|COO|CFO)\b|[.,\n]|$)/i
  );
  if (mainContactMatch?.[1]) {
    return mainContactMatch[1].trim().replace(/[.]$/, "");
  }

  const match = message.match(
    /\b(?:my name is|i am|i'm|name is)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:and|from|my|email|phone|number)\b|[.,\n]|$)/i
  );

  const name = match?.[1]?.trim().replace(/[.]$/, "") ?? null;
  if (!name) return null;

  const lowercaseName = name.toLowerCase();
  const blacklistedPhrases = [
    "not", "sure", "looking", "trying", "a ", "an ", "the ", "from", "here", "there", "some", "work", "need", "want", "website", "builder", "developer", "broker", "user", "customer"
  ];
  if (blacklistedPhrases.some(phrase => lowercaseName.startsWith(phrase) || lowercaseName.includes(" " + phrase))) {
    return null;
  }

  return name;
}

function extractContactRole(message: string) {
  return message.match(/\bmain contact (?:would be|is)\s+[A-Z][A-Za-z .'-]{1,60}?,\s*([^.\n]+?)(?=\s+at\s+[A-Z]|[.\n]|$)/i)?.[1]?.trim() ?? null;
}

function extractCompanyName(message: string) {
  const clearPath = message.match(/\bat\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/);
  if (clearPath?.[1]) {
    const candidate = clearPath[1].trim();
    if (!/\b(this stage|this point|this time)\b/i.test(candidate)) {
      return candidate;
    }
  }

  return message.match(/\bcompany\s+(?:is|name is)\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/i)?.[1]?.trim() ?? null;
}

function extractTimeline(message: string) {
  const discoveryMatch = message.match(/\b(?:start\s+)?discovery\s+within\s+(?:the\s+)?next\s+(\d+\s+weeks?|two\s+weeks?|three\s+weeks?|four\s+weeks?)\b/i);
  if (discoveryMatch?.[1]) {
    return `Start discovery within the next ${discoveryMatch[1]}`;
  }

  const timelineMatch = message.match(
    /\b(?:timeline|within|in|by)\s+([0-9]+\s*(?:days?|weeks?|months?)|two\s+weeks?|three\s+weeks?|four\s+weeks?|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december)\b/i
  );

  return timelineMatch?.[1]?.trim() ?? null;
}

function extractCountryLocation(message: string) {
  const match = message.match(
    /\b(?:i am from|i'm from|from|located in|based in)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:and|my|email|phone|number)\b|[.,\n]|$)/i
  );

  const location = match?.[1]?.trim().replace(/[.]$/, "") ?? null;
  if (!location) return null;

  const lowercaseLoc = location.toLowerCase();
  const blacklistedPhrases = [
    "a ", "an ", "the ", "our", "your", "my", "here", "there", "some", "web", "us", "them", "him", "her", "it", "this", "that"
  ];
  if (blacklistedPhrases.some(phrase => lowercaseLoc.startsWith(phrase) || lowercaseLoc.includes(" " + phrase))) {
    return null;
  }

  return location;
}

function sanitizeExtractedMemory(message: string, memory: RequirementMemory): RequirementMemory {
  const groundedMemory = removeUngroundedFields(message, memory);

  if (isContactOnlyMessage(message, groundedMemory) || isContactInfoOnlyMessage(message, groundedMemory)) {
    return removeNullishValues({
      latest_project_note: groundedMemory.latest_project_note ?? message,
      email: groundedMemory.email,
      phone: groundedMemory.phone,
      contact_name: groundedMemory.contact_name,
      contact_role: groundedMemory.contact_role,
      company_name: groundedMemory.company_name,
      country_location: groundedMemory.country_location
    });
  }

  // Preserve extracted memory if it contains any high-value project details
  const hasHighValueDetails = [
    "goals",
    "pain_points",
    "current_process",
    "teams_involved",
    "primary_bottleneck",
    "desired_outcome",
    "business_problem",
    "inquiry_volume",
    "traffic_volume",
    "support_workload",
    "existing_systems",
    "budget_range",
    "timeline",
    "required_features"
  ].some((key) => hasValue(groundedMemory[key]));

  if (hasHighValueDetails) {
    return groundedMemory;
  }

  if (!isInformationOnlyQuestion(message)) {
    return groundedMemory;
  }

  return {
    latest_project_note: message
  };
}

function removeUngroundedFields(message: string, memory: RequirementMemory): RequirementMemory {
  const grounded = { ...memory };

  if (
    hasValue(grounded.support_workload) &&
    !/\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|several)\s*(?:minutes?|hours?|days?|people|employees?|staff|fte|full[- ]time|part[- ]time)\b|\b(?:full[- ]time|part[- ]time)\b/i.test(message)
  ) {
    delete grounded.support_workload;
  }

  if (hasValue(grounded.inquiry_volume) && !/\b\d+\s*(?:loans?|inquiries?|requests?|transactions?|tickets?)\b/i.test(message)) {
    delete grounded.inquiry_volume;
  }

  if (hasValue(grounded.traffic_volume) && !/\b\d+[\d,]*\s*(?:visitors?|visits?|sessions?|users?)\b/i.test(message)) {
    delete grounded.traffic_volume;
  }

  if (hasValue(grounded.team_size) && !/\b\d+\s*(?:people|employees?|processors?|agents?|team members?|users?|staff)\b/i.test(message)) {
    delete grounded.team_size;
  }

  if (hasValue(grounded.service_type) && !hasExplicitServiceSelection(message)) {
    delete grounded.service_type;
  }

  return grounded;
}

function isContactOnlyMessage(message: string, memory: RequirementMemory) {
  const normalizedMessage = message
    .toLowerCase()
    .replace(emailPattern, "")
    .replace(phonePattern, "")
    .replace(/\b(?:email|e-mail|mail|phone|contact|number|is|:|-)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();

  return (hasValue(memory.email) || hasValue(memory.phone)) && normalizedMessage.length === 0;
}

function isContactInfoOnlyMessage(message: string, memory: RequirementMemory) {
  const hasContactInfo =
    hasValue(memory.email) ||
    hasValue(memory.phone) ||
    hasValue(memory.contact_name) ||
    hasValue(memory.country_location);

  if (!hasContactInfo) {
    return false;
  }

  return !/\b(?:crm|automation|automate|workflow|website|portal|dashboard|reporting|project|integrat|build|improve|need|want|budget|timeline|within|required|feature|software|system|app)\b/i.test(
    message
  );
}

function isInformationOnlyQuestion(message: string) {
  const normalizedMessage = message.toLowerCase().trim();

  if (
    emailPattern.test(message) ||
    phonePattern.test(message) ||
    /\b(?:my name is|i am|i'm|name is|my number is|phone is|contact number|i am from|i'm from|located in|based in)\b/i.test(
      normalizedMessage
    )
  ) {
    return false;
  }

  const looksLikeQuestion =
    normalizedMessage.includes("?") ||
    /\b(?:what|how|when|where|why|can you|could you|do you|does|kia|kya|kesy|kaise|kahan|kab|kitna|kitni|btao|batao)\b/i.test(
      normalizedMessage
    );

  if (!looksLikeQuestion) {
    return false;
  }

  return !/\b(?:we need|we want|i need|i want|looking to|want to|need to|project is|budget|timeline|spend|can spend|within|by q[1-4]|by january|by february|by march|by april|by may|by june|by july|by august|by september|by october|by november|by december)\b/i.test(
    normalizedMessage
  );
}

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function removeNullishValues(memory: RequirementMemory): RequirementMemory {
  return Object.fromEntries(
    Object.entries(memory).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed !== "" && trimmed !== "null" && trimmed !== "undefined";
      }
      return true;
    })
  ) as RequirementMemory;
}

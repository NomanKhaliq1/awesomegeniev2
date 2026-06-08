import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { generateWithSlm } from "@/lib/ai/modelClient";
import { parseJsonObject } from "@/lib/ai/parseJson";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/;

const servicePatterns = [
  {
    service: "Mortgage Automation",
    patterns: ["automation", "automate", "workflow", "manual steps"]
  },
  {
    service: "Mortgage Website Development",
    patterns: ["mortgage website", "website", "loan officer page", "broker site"]
  },
  {
    service: "MISMO Integration",
    patterns: ["mismo", "xml"]
  },
  {
    service: "Encompass Integration",
    patterns: ["encompass"]
  },
  {
    service: "BytePro Integration",
    patterns: ["bytepro"]
  },
  {
    service: "MeridianLink Integration",
    patterns: ["meridianlink", "meridian link"]
  },
  {
    service: "Power BI / Reporting",
    patterns: ["power bi", "dashboard", "reporting", "kpi"]
  },
  {
    service: "Salesforce Development",
    patterns: ["salesforce"]
  },
  {
    service: "CRM Integration",
    patterns: ["crm"]
  }
];

type ExtractRequirementMemoryOptions = {
  useSlm?: boolean;
};

export async function extractRequirementMemory(
  message: string,
  { useSlm = true }: ExtractRequirementMemoryOptions = {}
): Promise<RequirementMemory> {
  if (!useSlm) {
    return extractRequirementMemoryFallback(message);
  }

  try {
    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("extract_memory.system"),
      getPromptTemplate("extract_memory.user")
    ]);
    const content = await generateWithSlm({
      system,
      user: renderTemplate(userTemplate, { message })
    });
    const parsed = parseJsonObject<RequirementMemory>(content);

    if (parsed) {
      return removeNullishValues({
        latest_project_note: message,
        ...parsed
      });
    }
  } catch (error) {
    console.error("SLM extractRequirementMemory failed, using fallback:", error);
  }

  return extractRequirementMemoryFallback(message);
}

export function extractRequirementMemoryFallback(message: string): RequirementMemory {
  const normalizedMessage = message.toLowerCase();
  const memory: RequirementMemory = {
    latest_project_note: message
  };

  const email = message.match(emailPattern)?.[0];
  const phone = message.match(phonePattern)?.[0];

  if (email) {
    memory.email = email;
  }

  if (phone) {
    memory.phone = phone;
  }

  const serviceType = servicePatterns.find((candidate) =>
    candidate.patterns.some((pattern) => normalizedMessage.includes(pattern))
  )?.service;

  if (serviceType) {
    memory.service_type = serviceType;
  }

  const companyMatch = message.match(
    /(?:company|business|firm|organization|organisation)\s+(?:is|name is|:)?\s*([A-Z0-9][A-Z0-9 &,'-]{1,80}?)(?:\.|,|\n|$)/i
  );

  if (companyMatch?.[1]) {
    memory.company_name = companyMatch[1].trim().replace(/[.。]$/, "");
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

  return memory;
}

function removeNullishValues(memory: RequirementMemory): RequirementMemory {
  return Object.fromEntries(
    Object.entries(memory).filter(([, value]) => value !== null && value !== undefined && value !== "")
  ) as RequirementMemory;
}

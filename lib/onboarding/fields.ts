import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getSystemSetting } from "@/lib/data/settingsRepository";

export type RequiredField = {
  key: string;
  label: string;
  question: string;
  priority: "critical" | "important" | "optional";
};

const BUSINESS_CONTEXT_KEYS = ["goals", "pain_points", "business_problem", "project_overview"];

export const coreRequiredFields: RequiredField[] = [
  {
    key: "goals",
    label: "Business goals",
    question: "What is the main outcome you want to achieve with this project?",
    priority: "critical"
  },
  {
    key: "pain_points",
    label: "Pain points",
    question: "What is the single biggest bottleneck or challenge you are currently facing in this process?",
    priority: "critical"
  },
  {
    key: "business_problem",
    label: "Business problem",
    question: "What core business problem are you trying to solve?",
    priority: "critical"
  },
  {
    key: "project_overview",
    label: "Project overview",
    question: "Can you share a short overview of what you want to build or improve?",
    priority: "critical"
  },
  {
    key: "current_process",
    label: "Current process",
    question: "Can you walk me through how this process works today?",
    priority: "critical"
  },
  {
    key: "teams_involved",
    label: "Teams involved",
    question: "Which teams or roles are involved in this process?",
    priority: "critical"
  },
  {
    key: "primary_bottleneck",
    label: "Primary bottleneck",
    question: "Where does this process usually slow down or get stuck?",
    priority: "critical"
  },
  {
    key: "desired_outcome",
    label: "Desired outcome",
    question: "If this process worked exactly the way you'd like it to, what would be different?",
    priority: "critical"
  },
  {
    key: "existing_systems",
    label: "Existing systems & integrations",
    question: "What systems, platforms, or tools are currently involved in this workflow?",
    priority: "critical"
  },
  {
    key: "support_workload",
    label: "Support or operations workload",
    question: "Approximately how much manual effort or time does your team spend on this process?",
    priority: "important"
  },
  {
    key: "inquiry_volume",
    label: "Inquiry volume",
    question: "What is the typical volume of transactions, inquiries, or requests you handle in a given week?",
    priority: "important"
  },
  {
    key: "traffic_volume",
    label: "Website traffic",
    question: "How much traffic does your company website get monthly?",
    priority: "optional"
  },
  {
    key: "industry",
    label: "Industry sector",
    question: "What industry is your company in?",
    priority: "optional"
  },
  {
    key: "client_services",
    label: "Company services",
    question: "What core products or services does your company offer?",
    priority: "optional"
  },
  {
    key: "channels",
    label: "Communication channels",
    question: "Which communication channels are currently being used to coordinate this process?",
    priority: "important"
  },
  {
    key: "conversion_metrics",
    label: "Conversion or operational metrics",
    question: "Which operational metric or key performance indicator needs the most improvement?",
    priority: "important"
  },
  {
    key: "team_size",
    label: "Team size",
    question: "How many team members are involved in this process?",
    priority: "optional"
  },
  {
    key: "company_name",
    label: "Company name",
    question: "What is the name of your company?",
    priority: "important"
  },
  {
    key: "contact_name",
    label: "Contact person",
    question: "Who should our team contact about this project?",
    priority: "important"
  },
  {
    key: "email",
    label: "Email",
    question: "What email address should we use for follow-up?",
    priority: "important"
  },
  {
    key: "budget_range",
    label: "Budget range",
    question: "Do you have a budget range in mind?",
    priority: "important"
  },
  {
    key: "timeline",
    label: "Timeline",
    question: "What timeline are you hoping for?",
    priority: "important"
  },
  {
    key: "required_features",
    label: "Required features",
    question: "Which features or capabilities are required?",
    priority: "important"
  },
  {
    key: "service_type",
    label: "Service type",
    question: "Which of our services best fits this project?",
    priority: "important"
  }
];

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

function hasBusinessContext(memory: RequirementMemory): boolean {
  return BUSINESS_CONTEXT_KEYS.some((key) => hasValue(memory[key]));
}

export function detectIndustry(memory?: RequirementMemory): string | null {
  if (!memory) return null;
  const industryVal = memory.industry;
  if (typeof industryVal === "string" && industryVal.trim().length > 0 && industryVal !== "null" && industryVal !== "undefined") {
    return industryVal.toLowerCase();
  }

  const text = getMemoryText(memory);
  if (["healthcare", "medical", "patient", "clinical", "emr", "ehr", "hipaa"].some(kw => text.includes(kw))) {
    return "healthcare";
  }
  if (["legal", "law", "attorney", "court", "case management", "billing"].some(kw => text.includes(kw))) {
    return "legal";
  }
  if (["shopify", "e-commerce", "ecommerce", "retail", "store", "order", "inventory", "shipping"].some(kw => text.includes(kw))) {
    return "e-commerce";
  }
  if (["manufacturing", "factory", "production planning", "supply chain"].some(kw => text.includes(kw))) {
    return "manufacturing";
  }
  if (["saas", "subscription", "software", "product database", "signup"].some(kw => text.includes(kw))) {
    return "saas";
  }
  if (["agency", "agencies", "client project", "consulting"].some(kw => text.includes(kw))) {
    return "agency";
  }

  return null;
}

function adaptFieldForIndustry(field: RequiredField, industry: string): RequiredField {
  const ind = industry.toLowerCase();

  if (ind === "healthcare") {
    if (field.key === "existing_systems") {
      return {
        ...field,
        priority: "critical",
        question: "Which systems are involved besides your EHR/EMR, such as scheduling software, patient portals, or email/SMS tools?"
      };
    }
    if (field.key === "support_workload") {
      return {
        ...field,
        priority: "critical",
        question: "Which patient onboarding or clinical workflow stages currently require the most manual updates or coordination?"
      };
    }
    if (field.key === "channels") {
      return {
        ...field,
        priority: "important",
        question: "Which communication channels are used for patient notifications, portal updates, or internal staff coordination?"
      };
    }
    if (field.key === "project_overview") {
      return {
        ...field,
        priority: "critical",
        question: "Can you summarize the patient flow or clinical operations area you want to improve?"
      };
    }
    if (field.key === "required_features") {
      return {
        ...field,
        priority: "important",
        question: "Which capabilities matter most: patient portal integration, scheduling automation, HIPAA-compliant messaging, or staff workflow visibility?"
      };
    }
  }

  if (ind === "legal") {
    if (field.key === "existing_systems") {
      return {
        ...field,
        priority: "critical",
        question: "Which systems are involved, such as case management software, document repositories, billing software, or client portals?"
      };
    }
    if (field.key === "support_workload") {
      return {
        ...field,
        priority: "critical",
        question: "Which case management or document generation stages currently require the most manual updates or repeated data entry?"
      };
    }
    if (field.key === "project_overview") {
      return {
        ...field,
        priority: "critical",
        question: "Can you summarize the legal operations or document drafting workflow area you want to improve?"
      };
    }
    if (field.key === "required_features") {
      return {
        ...field,
        priority: "important",
        question: "Which capabilities matter most: document automation, billing system sync, client portals, case status notifications, or dashboard visibility?"
      };
    }
  }

  if (ind === "e-commerce" || ind === "retail") {
    if (field.key === "existing_systems") {
      return {
        ...field,
        priority: "critical",
        question: "Which platforms are involved, such as Shopify/Magento, ERP, shipping systems, or CRM tools?"
      };
    }
    if (field.key === "support_workload") {
      return {
        ...field,
        priority: "critical",
        question: "Which order fulfillment or customer support stages require the most manual coordination or repeated updates?"
      };
    }
    if (field.key === "project_overview") {
      return {
        ...field,
        priority: "critical",
        question: "Can you summarize the e-commerce checkout or operations workflow area you want to improve?"
      };
    }
    if (field.key === "required_features") {
      return {
        ...field,
        priority: "important",
        question: "Which capabilities matter most: order sync, inventory automation, automated shipping status notifications, or operations visibility?"
      };
    }
  }

  if (ind === "manufacturing") {
    if (field.key === "existing_systems") {
      return {
        ...field,
        priority: "critical",
        question: "Which systems are involved, such as ERP, inventory control, shipping coordination, or scheduling tools?"
      };
    }
    if (field.key === "support_workload") {
      return {
        ...field,
        priority: "critical",
        question: "Which production planning or supply chain coordination stages require the most manual updates?"
      };
    }
    if (field.key === "project_overview") {
      return {
        ...field,
        priority: "critical",
        question: "Can you summarize the supply chain or inventory management workflow area you want to improve?"
      };
    }
    if (field.key === "required_features") {
      return {
        ...field,
        priority: "important",
        question: "Which capabilities matter most: inventory sync, production scheduling automation, shipment updates, or shop floor visibility?"
      };
    }
  }

  if (ind === "saas" || ind === "software") {
    if (field.key === "existing_systems") {
      return {
        ...field,
        priority: "critical",
        question: "Which systems are involved, such as CRM, subscription billing platform, marketing automation, or product databases?"
      };
    }
    if (field.key === "support_workload") {
      return {
        ...field,
        priority: "critical",
        question: "Which customer onboarding or subscription lifecycle stages require the most manual coordination?"
      };
    }
    if (field.key === "project_overview") {
      return {
        ...field,
        priority: "critical",
        question: "Can you summarize the customer onboarding or subscription lifecycle workflow area you want to improve?"
      };
    }
    if (field.key === "required_features") {
      return {
        ...field,
        priority: "important",
        question: "Which capabilities matter most: subscription sync, automated customer emails, onboarding tasks automation, or analytics visibility?"
      };
    }
  }

  return field;
}

function hasWorkflowContextForIndustry(memory: RequirementMemory, industry: string): boolean {
  const text = getMemoryText(memory);
  const ind = industry.toLowerCase();

  const generalWorkflowKeywords = [
    "workflow", "step", "stage", "process", "manual", "manually", "coordination", "update", "updates", "status", "integration", "sync", "automation"
  ];
  return generalWorkflowKeywords.some((keyword) => text.includes(keyword));
}

function getFallbackFields(memory?: RequirementMemory): RequiredField[] {
  const industry = detectIndustry(memory);

  if (industry) {
    return coreRequiredFields.map((f) => adaptFieldForIndustry(f, industry));
  }

  return coreRequiredFields;
}

export async function getCoreRequiredFields(memory?: RequirementMemory): Promise<RequiredField[]> {
  const fields = await getSystemSetting<RequiredField[]>("core_required_fields");
  const baseFields = fields && fields.length > 0 ? fields : coreRequiredFields;

  const industry = detectIndustry(memory);

  if (industry) {
    return baseFields.map((f) => adaptFieldForIndustry(f, industry));
  }

  return baseFields;
}

export async function getMissingRequiredFields(memory: RequirementMemory): Promise<RequiredField[]> {
  const fields = await getCoreRequiredFields(memory);
  const skipBusinessContext = hasBusinessContext(memory);
  const industry = detectIndustry(memory);
  const memoryText = getMemoryText(memory);
  const skipWorkflowContext =
    industry ? hasWorkflowContextForIndustry(memory, industry) : false;

  return fields.filter((field) => {
    if (
      field.key === "traffic_volume" &&
      !/\b(website|web site|landing page|web portal|website traffic)\b/i.test(memoryText)
    ) {
      return false;
    }

    if (skipBusinessContext && BUSINESS_CONTEXT_KEYS.includes(field.key)) {
      return false;
    }

    if (
      skipWorkflowContext &&
      (field.key === "support_workload" ||
        field.key === "project_overview" ||
        field.key === "pain_points" ||
        field.key === "business_problem")
    ) {
      return false;
    }

    return !hasValue(memory[field.key]);
  });
}

export function calculateReadinessScore(memory: RequirementMemory): number {
  const industry = detectIndustry(memory);
  const fields = industry
    ? coreRequiredFields.map((f) => adaptFieldForIndustry(f, industry))
    : getFallbackFields(memory);

  const skipBusinessContext = hasBusinessContext(memory);
  const skipWorkflowContext = industry ? hasWorkflowContextForIndustry(memory, industry) : false;

  const criticalFields = fields.filter((field) => field.priority === "critical");

  if (criticalFields.length === 0) {
    return 100;
  }

  const completedCriticalCount = criticalFields.filter((field) => {
    if (skipBusinessContext && BUSINESS_CONTEXT_KEYS.includes(field.key)) {
      return true;
    }

    if (
      skipWorkflowContext &&
      (field.key === "support_workload" ||
        field.key === "project_overview" ||
        field.key === "pain_points" ||
        field.key === "business_problem")
    ) {
      return true;
    }

    return hasValue(memory[field.key]);
  }).length;

  return Math.round((completedCriticalCount / criticalFields.length) * 100);
}

export async function getDefaultMissingFields() {
  const [fields, initialKeys] = await Promise.all([
    getCoreRequiredFields(),
    getSystemSetting<string[]>("initial_missing_field_keys")
  ]);

  return fields
    .filter((field) => initialKeys.includes(field.key))
    .map((field) => field.label);
}

export async function calculateCompletionScore(memory: RequirementMemory) {
  const fields = await getCoreRequiredFields(memory);
  const missingFields = await getMissingRequiredFields(memory);
  const scoredFields = fields.filter((field) => field.priority !== "optional");
  const missingKeys = new Set(missingFields.map((field) => field.key));
  const completedCount = scoredFields.filter((field) => !missingKeys.has(field.key)).length;

  return scoredFields.length > 0
    ? Math.round((completedCount / scoredFields.length) * 100)
    : 100;
}

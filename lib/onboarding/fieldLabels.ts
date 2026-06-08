import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { coreRequiredFields } from "./fields";

const optionalFieldLabels: Record<string, string> = {
  phone: "Phone",
  website_url: "Website URL",
  country_location: "Country/location",
  industry: "Industry",
  current_process: "Current process",
  pain_points: "Pain points",
  success_outcome: "Success outcome",
  priority_level: "Priority level",
  existing_tools: "Existing tools",
  integration_requirements: "Integration requirements",
  content_assets_status: "Content/assets status"
};

export function getCollectedFieldLabels(memory: RequirementMemory) {
  const labels = [
    ...coreRequiredFields
      .filter((field) => hasValue(memory[field.key]))
      .map((field) => field.label),
    ...Object.entries(optionalFieldLabels)
      .filter(([key]) => hasValue(memory[key]))
      .map(([, label]) => label)
  ];

  return Array.from(new Set(labels));
}

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

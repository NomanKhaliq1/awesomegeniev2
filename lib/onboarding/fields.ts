import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getSystemSetting } from "@/lib/data/settingsRepository";

export type RequiredField = {
  key: string;
  label: string;
  question: string;
};

export const coreRequiredFields: RequiredField[] = [
  {
    key: "company_name",
    label: "Company name",
    question: "What is your company name?"
  },
  {
    key: "contact_name",
    label: "Contact person",
    question: "Who should the AwesomeTech team contact about this project?"
  },
  {
    key: "email",
    label: "Email",
    question: "What email address should we use for follow-up?"
  },
  {
    key: "service_type",
    label: "Service type",
    question: "Which service best fits this project?"
  },
  {
    key: "project_overview",
    label: "Project overview",
    question: "Can you share a short overview of what you want to build or improve?"
  },
  {
    key: "business_problem",
    label: "Business problem",
    question: "What business problem are you trying to solve?"
  },
  {
    key: "timeline",
    label: "Timeline",
    question: "What timeline are you hoping for?"
  },
  {
    key: "budget_range",
    label: "Budget range",
    question: "Do you have a budget range in mind?"
  },
  {
    key: "required_features",
    label: "Required features",
    question: "Which features or capabilities are required?"
  }
];

export async function getCoreRequiredFields() {
  return getSystemSetting<RequiredField[]>("core_required_fields");
}

export async function getMissingRequiredFields(memory: RequirementMemory) {
  const fields = await getCoreRequiredFields();

  return fields.filter((field) => {
    const value = memory[field.key];

    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    return value === undefined || value === null;
  });
}

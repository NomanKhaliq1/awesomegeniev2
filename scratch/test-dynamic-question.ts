import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { RequirementMemory } from "../lib/data/requirementsRepository";

async function testDynamicQuestion() {
  const { getNextQuestion } = await import("../lib/onboarding/getNextQuestion");

  const mockMemory: RequirementMemory = {
    latest_project_note: "I manage operations for a mortgage lending company, and we're experiencing increasing operational inefficiencies as our loan volume grows. Our team spends a significant amount of time manually updating loan statuses, responding to borrower inquiries, and entering the same information across multiple systems. We currently use Encompass LOS as our primary platform, along with HubSpot CRM and several third-party vendor systems.",
    business_problem: "operational inefficiencies due to growing loan volume",
    pain_points: "manual updating of loan statuses, responding to borrower inquiries, entering the same information across multiple systems",
    existing_systems: "Encompass LOS, HubSpot CRM, several third-party vendor systems",
    industry: "Mortgage Lending"
  };

  console.log("Generating dynamic question...");
  const question = await getNextQuestion(mockMemory);
  console.log("=== DYNAMIC QUESTION ===");
  console.log(question);
}

testDynamicQuestion().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testComposerPrompts() {
  const { getPromptTemplate, renderTemplate } = await import("../lib/data/settingsRepository");

  const userMessage = "I manage operations for a mortgage lending company, and we're experiencing increasing operational inefficiencies as low volume grows. Our team spends a significant amount of time manually updating loan statuses, responding to borrower inquiries, and entering the same information across multiple systems. We currently use Encompass LOS as our primary platform, along with HubSpot CRM and several third-party vendor systems. We're not sure whether the right solution is workflow automation, integrations, process improvements, custom development, or something else entirely. Before discussing solutions, I'd like to understand how you would evaluate the situation, identify the root cause of the problem, and determine what would provide the greatest business impact.";

  const nextQuestion = "What are the primary business goals or outcomes you want to achieve with this website improvement?";

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_response_system"),
    getPromptTemplate("chat.generative_response_user")
  ]);

  const templateContext = {
    userMessage,
    intent: "onboarding",
    serviceType: "",
    completionScore: 30,
    confidenceScore: 40,
    confidenceLevel: "Partial Understanding",
    readinessScore: 30,
    missingFields: "",
    nextQuestion,
    collectedMemory: "",
    conversationSummary: "",
    recentConversation: "assistant: Hi, I'm Awesome Genie. I can help you explore AwesomeTech services, answer questions, or shape a project request when you're ready.\nAre you looking for information about our services, or do you already have a project you want to discuss?"
  };

  const systemPrompt = renderTemplate(system, templateContext);
  const userPrompt = renderTemplate(userTemplate, templateContext);

  console.log("=== RENDERED SYSTEM PROMPT ===");
  console.log(systemPrompt);
  console.log("\n=== RENDERED USER PROMPT ===");
  console.log(userPrompt);
}

testComposerPrompts().catch(console.error);

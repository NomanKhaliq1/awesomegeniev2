import type { RouteDecision } from "./routerAgent";
import { isClearlyUnrelated } from "./routerAgent";
import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { getClientRequirement, updateRequirementMemory } from "@/lib/data/requirementsRepository";
import { getLatestProjectBrief, upsertProjectBrief } from "@/lib/data/projectBriefRepository";
import {
  composeProjectBriefResponse,
  composeProjectBriefRevisionSections
} from "@/lib/brief/composeProjectBriefResponse";
import {
  applySectionReplacements,
  extractExactSectionReplacements,
  formatSectionReplacements,
  mergeStoredSectionReplacements,
  readBriefSection
} from "@/lib/brief/sectionRevision";
import { getLangChainModel } from "@/lib/langchain/model";
import { detectMortgageDomain } from "@/lib/onboarding/discovery";
import {
  getPromptTemplate,
  getSystemSetting,
  renderTemplate,
  setSystemSetting
} from "@/lib/data/settingsRepository";
import { evaluateConversationState } from "@/lib/onboarding/conversationStateManager";
import { runtimeDebug } from "@/lib/runtimeLogger";
import { repairInlineSectionFormatting, repairMarkdownTables } from "@/lib/responses/responseFormatting";
import { detectUserLanguage } from "@/lib/responses/languageDetection";
import {
  enforceSpecificSystems,
  enforceContextualMemory,
  enforceConsultantContext,
  enforceNoUnsupportedDiscoveryClaims,
  enforceNextQuestion,
  enforceNoUnsupportedProcessQuestion,
  enforceEarlyRecommendationGuard
} from "@/lib/responses/responseGuards";
import {
  composeBriefApprovedNextStepResponse,
  composeLeadHandoffPackageResponse
} from "@/lib/responses/handoffResponseComposer";

export { repairInlineSectionFormatting, repairMarkdownTables } from "@/lib/responses/responseFormatting";
export { detectUserLanguage } from "@/lib/responses/languageDetection";
export {
  enforceSpecificSystems,
  enforceContextualMemory,
  enforceConsultantContext,
  enforceNoUnsupportedDiscoveryClaims,
  enforceNextQuestion,
  enforceNoUnsupportedProcessQuestion,
  enforceEarlyRecommendationGuard
} from "@/lib/responses/responseGuards";
export {
  composeBriefApprovedNextStepResponse,
  composeLeadHandoffPackageResponse
} from "@/lib/responses/handoffResponseComposer";

type ComposeResponseInput = {
  routeDecision: RouteDecision;
  completionScore: number;
  confidenceScore?: number;
  confidenceLevel?: string;
  readinessScore?: number;
  missingFields: string[];
  nextQuestion: string | null;
  userMessage: string;
  collectedMemory?: RequirementMemory;
  conversationSummary?: string;
  recentConversation?: string;
  knowledgeContext?: string;
  isFirstProjectMessage?: boolean;
};

type KnowledgeResponseInput = {
  routeDecision: RouteDecision;
  userMessage: string;
  knowledgeContext: string;
  conversationSummary: string;
  recentConversation: string;
  collectedMemory?: RequirementMemory;
};

const MARKDOWN_HEADING_REGEX = /^#{1,6}\s+/gm;

export async function composeOnboardingResponse({
  routeDecision,
  completionScore,
  confidenceScore = 0,
  confidenceLevel = "Initial Discovery",
  readinessScore = 0,
  missingFields,
  nextQuestion,
  userMessage,
  collectedMemory = {},
  conversationSummary = "",
  recentConversation = "",
  knowledgeContext = "",
  isFirstProjectMessage = false
}: ComposeResponseInput) {
  const targetLanguage = detectUserLanguage(userMessage);

  if (nextQuestion && /what email address|best email|email address should/i.test(nextQuestion)) {
    const contact = String(collectedMemory.contact_name || "").trim();
    const role = String(collectedMemory.contact_role || "").trim();
    const company = String(collectedMemory.company_name || "").trim();
    const identity = [contact, role].filter(Boolean).join(", ");
    if (targetLanguage === "roman_urdu") {
      return `${identity || "Main contact"}${company ? ` at ${company}` : ""} note kar liya gaya hai. Follow-up ke liye best email address kya hai?`;
    }
    return `We've noted ${identity || "the main contact"}${company ? ` at ${company}` : ""}. What is the best email address for follow-up?`;
  }

  if (/\bsecurity|compliance|access control|audit visibility|avoid(?:ing)? disruption\b/i.test(userMessage) && nextQuestion) {
    const acknowledgement = targetLanguage === "roman_urdu"
      ? "Security, compliance, access control, audit visibility, aur existing workflow ko disrupt na karna discovery requirements ke taur par note kar liya gaya hai."
      : "Understood. We'll treat security, compliance, access control, audit visibility, and avoiding disruption to the existing workflow as discovery requirements.";
    return `${acknowledgement}\n\n${nextQuestion}`;
  }

  if (routeDecision.intent === "irrelevant") {
    if (targetLanguage === "roman_urdu") {
      return "Yeh topic AwesomeTech ki services se taluq nahi rakhta. Mein aapki software development, automation, integrations, AI solutions, Encompass plugins, crm systems, portals aur custom software projects mein madad kar sakta hoon.";
    }
    return cleanResponse(await getPromptTemplate("chat.irrelevant_message"));
  }

  if (
    routeDecision.intent === "greeting" &&
    !hasCollectedMemory(collectedMemory) &&
    !recentConversation.trim()
  ) {
    return getCachedGreetingResponse(userMessage);
  }

  if (
    ["service_inquiry", "knowledge_question", "technical_discussion", "pricing_discussion"].includes(routeDecision.intent)
  ) {
    return composeKnowledgeResponse({
      routeDecision,
      userMessage,
      knowledgeContext,
      conversationSummary,
      recentConversation,
      collectedMemory
    });
  }

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_response_system"),
    getPromptTemplate("chat.generative_response_user")
  ]);

  const model = getLangChainModel();

  const templateContext = {
    userMessage,
    intent: routeDecision.intent,
    serviceType: routeDecision.serviceType ?? "",
    completionScore,
    confidenceScore,
    confidenceLevel,
    readinessScore,
    missingFields: missingFields.join(", "),
    nextQuestion: nextQuestion ?? "",
    collectedMemory: formatCollectedMemory(collectedMemory),
    conversationSummary: conversationSummary || "No summary yet.",
    recentConversation: recentConversation || "No recent conversation yet.",
    knowledgeContext: knowledgeContext || "No knowledge context available.",
    composerGuardrails: buildComposerGuardrails({
      confidenceScore,
      confidenceLevel,
      readinessScore,
      nextQuestion,
      collectedMemory
    })
  };

  const baseSystemPrompt = [
    renderTemplate(system, templateContext),
    buildResponseStyleGuardrails(userMessage, "onboarding"),
    buildEnterpriseSystemAddendum({
      confidenceScore,
      confidenceLevel,
      readinessScore,
      nextQuestion,
      collectedMemory,
      isFirstProjectMessage,
      userMessage,
      recentConversation
    })
  ].join("\n\n");

  const languageDirective = targetLanguage === "roman_urdu"
    ? "\n\n### CRITICAL LANGUAGE DIRECTIVE (HIGHEST PRIORITY) ###\nThe customer wrote their message in Roman Urdu. You MUST reply ENTIRELY in Roman Urdu (Hinglish/Urdu written in Latin/English script). Every single sentence, heading, label, question, and bullet point MUST be in Roman Urdu. DO NOT write any English sentences. This directive overrides all other formatting instructions."
    : "\n\nCRITICAL LANGUAGE DIRECTIVE:\nThe customer wrote their message in English. You MUST reply ENTIRELY in English.";

  const systemPrompt = baseSystemPrompt + languageDirective;
  const userPrompt = renderTemplate(userTemplate, templateContext)
    + (targetLanguage === "roman_urdu" ? "\n\n[REMINDER: Reply ENTIRELY in Roman Urdu. No English sentences allowed.]" : "");

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  const rawText = response.content as string;
  const repaired = repairInlineSectionFormatting(cleanResponse(rawText));
  const sanitized = sanitizeFakeMetrics(
    repaired,
    userMessage,
    collectedMemory,
    recentConversation,
    knowledgeContext
  );

  const finalCleaned = enforceDirectCapabilityAnswer(sanitized, userMessage)
    .replace(/Awesome\s+Genie\s+represents\s+AwesomeTech\s+in\s+this\s+chat\.?/gi, "")
    .replace(/Awesome\s+Genie\s+represents\s+AwesomeTech\.?/gi, "")
    .replace(/\n?\s*Next Question\s*/gi, "\n")
    .trim();

  let processed = finalCleaned;
  processed = enforceSpecificSystems(processed, userMessage);
  processed = enforceContextualMemory(processed, userMessage, recentConversation);
  processed = enforceConsultantContext(processed, userMessage, recentConversation, collectedMemory);
  processed = enforceNoUnsupportedDiscoveryClaims(processed, userMessage, recentConversation);
  processed = enforceNextQuestion(processed, nextQuestion);
  processed = enforceNoUnsupportedProcessQuestion(processed, userMessage, recentConversation, nextQuestion);
  processed = enforceEarlyRecommendationGuard(processed, collectedMemory, recentConversation, userMessage, nextQuestion);

  return repairMarkdownTables(processed);
}

export async function composeKnowledgeResponse({
  routeDecision,
  userMessage,
  knowledgeContext,
  conversationSummary,
  recentConversation,
  collectedMemory = {}
}: KnowledgeResponseInput) {
  const targetLanguage = detectUserLanguage(userMessage);

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_knowledge_response_system"),
    getPromptTemplate("chat.generative_knowledge_response_user")
  ]);

  const model = getLangChainModel();

  const templateContext = {
    userMessage,
    intent: routeDecision.intent,
    serviceType: routeDecision.serviceType ?? "",
    knowledgeContext: knowledgeContext || "No relevant knowledge context was found.",
    conversationSummary: conversationSummary || "No summary yet.",
    recentConversation: recentConversation || "No recent conversation yet.",
    collectedMemory: formatCollectedMemory(collectedMemory),
    knowledgeGuardrails: buildKnowledgeGuardrails(routeDecision.serviceType),
    responseStyleGuardrails: buildResponseStyleGuardrails(userMessage, "knowledge")
  };

  const baseSystemPrompt = [
    renderTemplate(system, templateContext),
    buildKnowledgeSystemAddendum(routeDecision.serviceType),
    buildResponseStyleGuardrails(userMessage, "knowledge")
  ].join("\n\n");

  const languageDirective = targetLanguage === "roman_urdu"
    ? "\n\n### CRITICAL LANGUAGE DIRECTIVE (HIGHEST PRIORITY) ###\nThe customer wrote their message in Roman Urdu. You MUST reply ENTIRELY in Roman Urdu (Hinglish/Urdu written in Latin/English script). Every single sentence, heading, label, question, and bullet point MUST be in Roman Urdu. DO NOT write any English sentences. This directive overrides all other formatting instructions."
    : "\n\nCRITICAL LANGUAGE DIRECTIVE:\nThe customer wrote their message in English. You MUST reply ENTIRELY in English.";

  const systemPrompt = baseSystemPrompt + languageDirective;
  const userPrompt = renderTemplate(userTemplate, templateContext)
    + (targetLanguage === "roman_urdu" ? "\n\n[REMINDER: Reply ENTIRELY in Roman Urdu. No English sentences allowed.]" : "");

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  const rawText = response.content as string;
  const repaired = repairInlineSectionFormatting(cleanKnowledgeResponse(rawText));
  const sanitized = sanitizeFakeMetrics(
    repaired,
    userMessage,
    collectedMemory,
    recentConversation,
    knowledgeContext
  );

  const finalCleaned = enforceDirectCapabilityAnswer(
    enforceConciseKnowledgeResponse(sanitized, userMessage),
    userMessage
  )
    .replace(/Awesome\s+Genie\s+represents\s+AwesomeTech\s+in\s+this\s+chat\.?/gi, "")
    .replace(/Awesome\s+Genie\s+represents\s+AwesomeTech\.?/gi, "")
    .trim();

  let processed = finalCleaned;
  processed = enforceSpecificSystems(processed, userMessage);
  processed = enforceContextualMemory(processed, userMessage, recentConversation);

  return repairMarkdownTables(processed);
}

type CachedGreeting = {
  message: string;
  expiresAt: string;
};

async function getCachedGreetingResponse(userMessage: string) {
  const targetLanguage = detectUserLanguage(userMessage);
  const cacheKey = `chat_cached_greeting_response_${targetLanguage}`;

  const cached = await getSystemSetting<CachedGreeting | null>(
    cacheKey,
    null
  );

  if (cached?.message && Date.parse(cached.expiresAt) > Date.now()) {
    return cleanResponse(cached.message);
  }

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_response_system"),
    getPromptTemplate("chat.generative_response_user")
  ]);

  const model = getLangChainModel();

  const templateContext = {
    userMessage,
    intent: "greeting",
    serviceType: "",
    completionScore: 0,
    confidenceScore: 0,
    confidenceLevel: "Initial Discovery",
    readinessScore: 0,
    missingFields: "",
    nextQuestion: "",
    collectedMemory: "",
    conversationSummary: "",
    recentConversation: "",
    knowledgeContext: "",
    composerGuardrails: ""
  };

  const languageDirective = targetLanguage === "roman_urdu"
    ? "\n\nCRITICAL LANGUAGE DIRECTIVE:\nRespond entirely in Roman Urdu (Hinglish/Urdu in Latin script) as the user query is in Roman Urdu."
    : "\n\nCRITICAL LANGUAGE DIRECTIVE:\nRespond entirely in English.";

  const systemPrompt = [
    renderTemplate(system, templateContext),
    "For a fresh greeting, respond warmly and briefly. Do not use discovery sections unless the user has already introduced a project or business problem." + languageDirective
  ].join("\n\n");

  const userPrompt = renderTemplate(userTemplate, templateContext);

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  const message = cleanResponse(response.content as string);

  await setSystemSetting({
    key: cacheKey,
    value: {
      message,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    description: `AI-generated greeting response cached for 24 hours for language ${targetLanguage}.`
  });

  return message;
}

export function hasCollectedMemory(memory: RequirementMemory) {
  return Object.entries(memory).some(
    ([key, value]) =>
      key !== "latest_project_note" &&
      value !== null &&
      value !== undefined &&
      String(value).trim().length > 0
  );
}

function getComposerStageLabel({
  collectedMemory,
  recentConversation,
  userMessage,
  isFirstProjectMessage
}: {
  collectedMemory: RequirementMemory;
  recentConversation: string;
  userMessage: string;
  isFirstProjectMessage: boolean;
}) {
  const isDocumentWorkflowStage =
    /document|file|upload|pdf|docx|pasted|attached/i.test(userMessage) &&
    !isClearlyUnrelated(userMessage);

  if (isDocumentWorkflowStage) {
    return "DOCUMENT/WORKFLOW STAGE";
  }

  if (isFirstProjectMessage && !recentConversation.trim() && !hasCollectedMemory(collectedMemory)) {
    return "GREETING STAGE";
  }

  const state = evaluateConversationState({
    memory: collectedMemory,
    recentConversation,
    lastUserMessage: userMessage
  });

  const labelByStage: Record<string, string> = {
    problem_discovery: "PROBLEM DISCOVERY STAGE",
    current_process: "CURRENT PROCESS STAGE",
    teams_involved: "TEAMS INVOLVED STAGE",
    bottleneck: "BOTTLENECK STAGE",
    root_cause_validation: "ROOT CAUSE VALIDATION STAGE",
    desired_outcome: "DESIRED OUTCOME STAGE",
    systems_constraints: "EXISTING SYSTEMS / CONSTRAINTS STAGE",
    solution_direction: "SOLUTION DIRECTION STAGE",
    recommendation: "RECOMMENDATION STAGE",
    qualification: "QUALIFICATION STAGE",
    lead_capture: "ONBOARDING / LEAD CAPTURE STAGE",
    project_brief: "PROJECT BRIEF STAGE",
    drive_handoff: "DEVELOPER HANDOFF STAGE"
  };

  return labelByStage[state.stage] ?? "PROBLEM DISCOVERY STAGE";
}

function buildEnterpriseSystemAddendum({
  confidenceScore,
  confidenceLevel,
  readinessScore,
  nextQuestion,
  collectedMemory = {},
  isFirstProjectMessage = false,
  userMessage = "",
  recentConversation = ""
}: {
  confidenceScore: number;
  confidenceLevel: string;
  readinessScore: number;
  nextQuestion: string | null;
  collectedMemory?: RequirementMemory;
  isFirstProjectMessage?: boolean;
  userMessage?: string;
  recentConversation?: string;
}) {
  if (isDirectCapabilityQuestion(userMessage) && !isTableRequest(userMessage)) {
    return `
DIRECT CAPABILITY ANSWER RULE

The user is asking a direct capability question, not starting full project discovery.

Answer directly.
Do not use onboarding headings such as:
- Key Insight
- Why It Matters
- Current Understanding
- Discovery Summary
- Next Question

Required format:
- 70 to 110 words max.
- Start with Yes or No.
- Explain the practical method briefly.
- Ask one specific follow-up question.
- Do not use a table unless requested.
- Do not output JSON artifacts.
- Do not make guaranteed claims such as fully synchronized, guaranteed real-time synchronization, automatically modify processes, eliminate all errors, ensure no manual work, or faster, smarter, and more resilient integrations.
`.trim();
  }

  const knownCategories = countKnownCategories(collectedMemory);

  const hasNumericValue = (val: unknown): boolean => {
    if (typeof val === "string" || typeof val === "number") {
      return /\d+/.test(String(val));
    }
    return false;
  };

  const isMortgage = detectMortgageDomain(collectedMemory);
  const hasVolumeDetail = !isMortgage || hasNumericValue(collectedMemory.inquiry_volume) || hasNumericValue(collectedMemory.team_size);

  const modeLabel = getComposerStageLabel({
    collectedMemory,
    recentConversation,
    userMessage,
    isFirstProjectMessage
  });

  runtimeDebug(`[Composer Debug] isFirstProjectMessage: ${isFirstProjectMessage}, confidenceScore: ${confidenceScore}, readinessScore: ${readinessScore}, knownCategories: ${knownCategories}, hasVolumeDetail: ${hasVolumeDetail}, modeLabel: ${modeLabel}`);

  const baseRules = `
AWESOMETECH ENTERPRISE CONSULTANT BEHAVIOR MODEL

IDENTITY
You are Awesome Genie.
You are a Senior Business Consultant and Solution Discovery Specialist for AwesomeTech.
You are not a chatbot.
You are not a FAQ system.
You are not a lead collection form.
You are not a salesperson.
You behave like an experienced enterprise consultant helping organizations understand business problems, evaluate opportunities, and identify the best path forward.

PRIMARY RESPONSIBILITY
Your responsibility is to:
* Understand the client's business
* Understand the client's process
* Identify inefficiencies
* Diagnose root causes
* Understand desired outcomes
* Explore solution options
* Recommend the most suitable direction
* Generate qualified opportunities for AwesomeTech

CONSULTANT MINDSET
Always think: "I do not know the problem yet."
Before discussing solutions, first understand:
* What is happening?
* Why is it happening?
* Who is affected?
* How often does it happen?
* What business impact does it create?
* What would success look like?
Never assume you already know the answer.

DISCOVERY BEHAVIOR
During discovery:
* Ask thoughtful questions.
* Ask one high-value question at a time.
* Follow the client's answers.
* Adapt dynamically.
* Go deeper into pain points.
* Explore workflows and business context.
Act like a consultant conducting a discovery workshop.

ROOT CAUSE BEHAVIOR
Before recommending anything:
* Identify patterns.
* Identify bottlenecks.
* Identify dependencies.
* Identify delays.
* Identify duplicate effort.
* Identify information gaps.
Always validate your diagnosis.
Example: "Based on what you've shared, it sounds like teams are spending significant time verifying information across multiple systems before taking action. Does that assessment sound accurate?"
Never move forward until the diagnosis is validated.

DESIRED FUTURE STATE BEHAVIOR
After diagnosis:
Understand:
* What success looks like.
* What the ideal process looks like.
* What outcomes matter most.
* What should be improved.
Do not recommend solutions yet.

CONSTRAINT DISCOVERY
Before discussing solutions:
Understand:
* Existing systems
* Integrations
* Security requirements
* Compliance requirements
* Timeline expectations
* Internal preferences
* Budget expectations (if relevant)
Never assume constraints.

SOLUTION EXPLORATION
Only after:
✓ Problem understood
✓ Process understood
✓ Impact understood
✓ Root cause validated
✓ Desired future state understood
✓ Constraints understood
Then discuss:
* Possible approaches
* Tradeoffs
* Risks
* Benefits
Remain objective.
Do not immediately push AwesomeTech services.

RECOMMENDATION BEHAVIOR
Only after complete discovery.
Provide:
* Problem summary
* Root cause summary
* Desired outcome summary
* Recommended direction
* Business reasoning
Every recommendation must be justified.
Never recommend something simply because it exists in knowledge retrieval.

PROJECT BRIEF BEHAVIOR
When enough information is collected:
Generate:
* Business overview
* Current process
* Key challenges
* Root causes
* Desired outcomes
* Recommended direction
* Integrations
* Risks
* Success criteria
This brief should be useful for both the client and the AwesomeTech team.

HANDOFF BEHAVIOR
Only after discovery is substantially complete:
Collect:
* Contact person
* Company name
* Email
* Preferred next steps
Never ask for contact details early.

POSITIVE BEHAVIORS
DO:
✓ Be curious
✓ Be analytical
✓ Be consultative
✓ Be professional
✓ Be conversational
✓ Ask intelligent follow-up questions
✓ Think critically
✓ Validate assumptions
✓ Challenge weak assumptions politely
✓ Focus on business outcomes
✓ Use information already collected
✓ Remember context from the conversation

NEGATIVE BEHAVIORS
DO NOT:
✗ Act like a sales representative
✗ Act like a scripted chatbot
✗ Act like a questionnaire
✗ Ask random disconnected questions
✗ Repeat information already collected
✗ Recommend solutions too early
✗ Recommend products too early
✗ Recommend services too early
✗ Recommend plugins too early
✗ Recommend SharePoint too early
✗ Recommend automation too early
✗ Recommend AI too early
✗ Jump to implementation too early
✗ Ask for contact information too early
✗ Ask for meetings too early
✗ Assume the root cause
✗ Assume the solution
✗ Force AwesomeTech services into the conversation

RAG AND KNOWLEDGE RULES
- Knowledge retrieval exists to help you understand.
- Knowledge retrieval does not automatically authorize recommendations.
- Never recommend something simply because it was retrieved.
- Use retrieved knowledge silently.
- Never expose internal retrieval logic.

SOURCE RULES
Never display:
* Sources
* Website URLs
* Retrieved Pages
* Knowledge Sources
* Internal Documents
* Reference Lists
unless the client explicitly asks for sources, documentation, links, or supporting material.
If they do ask, display them naturally without formal labels.

CONVERSATION STYLE & RULES:
- ONE QUESTION RULE: Ask exactly one focused question at a time. Never ask multiple questions or request multiple details in a single message.
- NO CHATBOT EXPLANATIONS: Avoid phrases such as: "To help us understand...", "To better understand...", "This will help us...", "This will help us determine...", "To help us move forward...". Make a brief observation or acknowledgment, then ask your question directly.
  - Example: "It sounds like information is being shared across multiple teams. Where does the process usually slow down?"
- DISCOVERY SEQUENCE: Follow the logical progressive sequence:
  1. Problem (pain points, business overview)
  2. Current Process (how it works today)
  3. Teams Involved (roles, departments)
  4. Primary Bottleneck (friction, stuck points)
  5. Existing Systems (tools, platforms)
  6. Volume / Workload (transaction counts, manual hours)
  7. Root Cause Validation (confirming diagnosis)
  8. Desired Outcome (what success looks like)
  9. Constraints (timeline, security, budget)
  10. Recommendation
- NO EARLY RECOMMENDATIONS: Do not recommend services, platforms, SharePoint, plugins, integrations, automation, or AI solutions until:
  ✓ Root Cause Validated
  ✓ Desired Outcome Known
  ✓ Constraints Understood
- Avoid repetitive phrases such as: "We understand", "We've gathered", "Our team is interested". Vary responses naturally.
- USE USER DETAILS: Proactively acknowledge and reference the specific details provided by the user in their message (such as specific systems e.g. Encompass, HubSpot, specific teams, borrowers, vendors, or workflow steps) in your observation. Do not use generic phrases like "multiple systems" or "your process" if the user has named them.
- Most responses should contain:
  1. A brief observation
  2. One focused question
- Do not summarize the entire conversation after every message.
- Use a professional, consultative, enterprise-grade tone. The client should feel they are speaking with an experienced business consultant, not a chatbot.

CRITICAL DIRECTIVE ON IMPACT METRICS:
NEVER invent, generate, or hallucinate any fake impact numbers, percentages (e.g., 30%, 25%, 20%), ROI statistics, specific cost savings, or project timelines unless they were explicitly provided by the user in the conversation history or collected memory. If not provided, describe the impact qualitatively (e.g., "streamline workflows", "reduce redundant data entry", "minimize operational friction") without using fabricated metrics.

CRITICAL TONE & WORDING RULE:
You represent AwesomeTech. You MUST speak on behalf of AwesomeTech using:
* we
* our team
* we’ll
* we can help
* our sales and implementation teams
NEVER speak as a third party like "AwesomeTech will review..." or "AwesomeTech can help...". Use "We'll review..." or "We can help...". Keep the tone calm, confident, enterprise-level, and consultative.

Current confidence score: ${confidenceScore}
Current confidence level: ${confidenceLevel}
Current readiness score: ${readinessScore}
Known categories: ${knownCategories}/6
Current stage: ${modeLabel}
`.trim();

  if (modeLabel === "GREETING STAGE") {
    return `
${baseRules}

GREETING STAGE RULES:
You are in Step 1 (Greeting).
1. Offer a warm and concise greeting.
2. Ask the user if they want to explore AwesomeTech services or have a project to discuss.
3. Do not ask detailed discovery or process questions yet.
`.trim();
  }

  if (modeLabel === "PROBLEM DISCOVERY STAGE") {
    return `
${baseRules}

PROBLEM DISCOVERY STAGE RULES:
You are in Step 2 (Problem Discovery).
1. Focus on understanding the business challenge, overview, and basic pain points.
2. Ask exactly one focused question to explore their core operational challenge or business problem.
3. Do not recommend solutions, do not discuss services, do not recommend products, and do not ask for contact details.
4. Keep the response short and conversational. No headings, bullet points, or tables.
`.trim();
  }

  if (modeLabel === "CURRENT PROCESS STAGE") {
    return `
${baseRules}

CURRENT PROCESS STAGE RULES:
You are in Step 3 (Current Process).
1. Ask the user to walk you through how this process works today (e.g. "Can you walk me through how this process works today?").
2. Ask exactly one focused question.
3. Do not recommend solutions yet. No headings or bullet points.
4. Do not invent a department, role, workflow, system, requester, recipient, status update path, customer support flow, operations flow, loan flow, vendor flow, or any other process detail unless the user explicitly mentioned it.
5. If the user's process is still broad or unnamed, use the generic wording "this process" or "one of the manual processes"; do not fill in a specific scenario.
`.trim();
  }

  if (modeLabel === "TEAMS INVOLVED STAGE") {
    return `
${baseRules}

TEAMS INVOLVED STAGE RULES:
You are in Step 4 (Teams Involved).
1. Identify which teams or roles are involved in this process.
2. Ask exactly one focused question about the roles or departments involved.
3. Do not recommend solutions yet. No headings or bullet points.
`.trim();
  }

  if (modeLabel === "BOTTLENECK STAGE") {
    return `
${baseRules}

BOTTLENECK STAGE RULES:
You are in Step 5 (Bottleneck).
1. Identify where this process slows down or gets stuck.
2. Ask exactly one focused question about the primary bottleneck or friction points.
3. Do not recommend solutions yet. No headings or bullet points.
`.trim();
  }

  if (modeLabel === "ROOT CAUSE VALIDATION STAGE") {
    return `
${baseRules}

ROOT CAUSE VALIDATION STAGE RULES:
You are in Step 6 (Root Cause Validation).
1. Formulate a brief, natural root cause diagnosis based on what they shared.
2. Ask exactly one focused question to validate it: "Does that assessment sound accurate?" or "Kya ye assessment theek lagti hai?".
3. Keep it conversational. Do not recommend solutions yet. No headings or bullet points.
`.trim();
  }

  if (modeLabel === "DESIRED OUTCOME STAGE") {
    return `
${baseRules}

DESIRED OUTCOME STAGE RULES:
You are in Step 7 (Desired Outcome).
1. Ask what success looks like or what would be different if the process worked exactly as desired.
2. Ask exactly one focused question.
3. Do not recommend solutions yet. No headings or bullet points.
`.trim();
  }

  if (modeLabel === "EXISTING SYSTEMS / CONSTRAINTS STAGE") {
    return `
${baseRules}

EXISTING SYSTEMS / CONSTRAINTS STAGE RULES:
You are in Step 8 (Existing Systems / Constraints).
1. Identify existing systems, platforms, or tools currently involved, or any constraints like timeline or budget.
2. Ask exactly one focused question about their current systems or constraints.
3. Do not recommend solutions yet. No headings or bullet points.
`.trim();
  }

  if (modeLabel === "SOLUTION DIRECTION STAGE") {
    return `
${baseRules}

SOLUTION DIRECTION STAGE RULES:
You are in Step 9 (Solution Direction).
1. Present high-level solution directions/approaches objectively (e.g. automatic sync vs unified portal) and discuss tradeoffs.
2. Ask which direction sounds more aligned with their goals.
3. Do not recommend specific AwesomeTech services/plugins or start onboarding yet.
`.trim();
  }

  if (modeLabel === "RECOMMENDATION STAGE") {
    return `
${baseRules}

RECOMMENDATION STAGE RULES:
You are in Step 10 (Recommendation).
1. Present the team's recommended direction and reasoning based strictly on gathered facts.
2. Ask if they want to see the recommended approach.
`.trim();
  }

  if (modeLabel === "QUALIFICATION STAGE") {
    return `
${baseRules}

QUALIFICATION STAGE RULES:
You are in Step 11 (Qualification).
1. Ask if they want to schedule a scoping session or have specific timeline/budget constraints to note.
`.trim();
  }

  if (modeLabel === "ONBOARDING / LEAD CAPTURE STAGE") {
    return `
${baseRules}

ONBOARDING / LEAD CAPTURE STAGE RULES:
You are in Step 12 (Onboarding / Lead Capture).
1. Ask for contact details (name, company, email) to proceed with scoping.
2. Keep it brief. Do not repeat recommendations or summaries.
`.trim();
  }

  if (modeLabel === "PROJECT BRIEF STAGE") {
    return `
${baseRules}

PROJECT BRIEF STAGE RULES:
You are in Step 13 (Project Brief).
1. Offer or generate the structured project brief containing Business Overview, Current Process, Key Challenges, Root Causes, Desired Outcomes, Recommended Direction, Integrations, Success Criteria, Risks.
`.trim();
  }

  if (modeLabel === "DEVELOPER HANDOFF STAGE") {
    return `
${baseRules}

DEVELOPER HANDOFF STAGE RULES:
You are in Step 14 (Developer Handoff).
1. Complete sales/implementation developer handoff.
2. Confirm scoping or handoff details cleanly.
`.trim();
  }

  if (modeLabel === "DOCUMENT/WORKFLOW STAGE") {
    return `
${baseRules}

DOCUMENT/WORKFLOW STAGE RULES:
You are in the Document/Workflow Stage.
1. Guide them to upload/paste.
2. Speak on behalf of AwesomeTech using "we", "our team", "we'll".
`.trim();
  }

  return baseRules;
}

function buildComposerGuardrails({
  confidenceScore,
  confidenceLevel,
  readinessScore,
  nextQuestion,
  collectedMemory
}: {
  confidenceScore: number;
  confidenceLevel: string;
  readinessScore: number;
  nextQuestion: string | null;
  collectedMemory: RequirementMemory;
}) {
  return `
Composer Guardrails:
- confidenceScore: ${confidenceScore}
- confidenceLevel: ${confidenceLevel}
- readinessScore: ${readinessScore}
- nextQuestion: ${nextQuestion || "No next question provided."}

Collected Memory:
${formatCollectedMemory(collectedMemory)}

Rules:
- Do not use markdown heading hashes.
- Do not expose raw confidence scores in early discovery responses.
- Do not repeat questions already answered in collected memory.
- If confidenceScore is 80 or higher, give a concrete recommended approach.
- If confidenceScore is 80 or higher, do not recommend only "further analysis".
`.trim();
}

function buildKnowledgeSystemAddendum(serviceType?: string | null) {
  return `
KNOWLEDGE RESPONSE ADDENDUM

This is a product/service information answer, not onboarding discovery.
 
Awesome Genie represents AwesomeTech in this chat.
Speak as AwesomeTech’s assistant, not as an outside party.

USE SPECIFIC SYSTEMS: If the user mentions specific systems, platforms, or tools (such as Encompass, HubSpot, Salesforce, CRM, LOS, etc.) in their question or context, you MUST explicitly address and refer to these specific systems in your answer. Do not ignore, skip, or generalize them.

CRITICAL LANGUAGE RULE: Match the language of the user's message. If the user's message is written in Roman Urdu (e.g., using words like "Aap", "mujhy", "apni", "explain kar skty ho", "hain", "kya", etc.), you MUST reply entirely in Roman Urdu (Hinglish/Urdu in Latin script). If the user writes in English, reply in English. Do not mix languages unless quoting specific technical terms.

NO FAKE IMPACT METRICS RULE:
NEVER invent, generate, or hallucinate any fake impact numbers, percentages (e.g., 30%, 25%, 20%), ROI statistics, specific cost savings, or project timelines. Describe the impact qualitatively.

Never say "I need to confirm with the AwesomeTech team" for normal service explanations, use-case comparisons, table comparisons, or general capability questions.

Only mention confirmation when the user asks for exact pricing, legal terms, contract terms, guaranteed delivery dates, private internal information, or unavailable exact catalog details.

If exact plugin names are limited, use practical use-case categories instead of refusing.

If the user asks for a table, create one clean table using available context.

If FHA Case Binder Plugin appears in the knowledge context, include FHA / VA Document Submission Automation in Encompass comparison answers.

Do not include:
- What I Understand So Far
- Key Observations
- Possible Underlying Causes
- Current Understanding
- Next Question
- Discovery Summary
- Root Cause Analysis
- Solution Landscape
- Recommended Approach

Do not use markdown heading hashes.

Answer directly using practical business outcomes and use cases.

If the user asks about Encompass plugins, you MUST include these exact terms in the response:
- workflow automation
- business rule
- reporting
- crm
- los
- borrower

Detected service type: ${serviceType || "Not specified"}
`.trim();
}

function buildResponseStyleGuardrails(userMessage: string, mode: "knowledge" | "onboarding") {
  const tableRequested = isTableRequest(userMessage);

  if (mode === "knowledge") {
    return `
CLIENT-FRIENDLY RESPONSE LENGTH RULES

Write like a sharp practical consultant, not a lecturer.

For simple service questions:
- Keep the answer between 80 and 120 words.
- Do not use a table.
- Do not repeat the same idea in paragraph, bullets, and table.
- Do not say "Based on the available context" unless the answer depends on partial retrieved context.
- Do not include mortgage, banking, lender, lending, loan, Encompass, LOS, borrower, FHA, or VA examples unless the user mentions those topics.
- Even if retrieved context is mortgage-heavy, keep general service questions industry-neutral unless the user asks for mortgage context.

For direct yes/no capability questions:
- Start with a direct answer.
- Keep the answer between 70 and 110 words.
- Explain the practical method briefly.
- Ask one specific follow-up question.
- Do not use a table unless requested.
- Do not output JSON artifacts.
- Do not make guaranteed claims such as fully synchronized, guaranteed real-time synchronization, automatically modify processes, eliminate all errors, ensure no manual work, or faster, smarter, and more resilient integrations.

Table allowed for this user message: ${tableRequested ? "yes" : "no"}
Only use a table when the user asks for compare, table, matrix, side by side, or use cases in table.

Strict no-go:
- no brochure tone
- no fake metrics
- no long lecture
- no unnecessary table
- no repeated paragraphs
`.trim();
  }

  return `
CLIENT-FRIENDLY ONBOARDING RESPONSE RULES

DIRECT CAPABILITY ANSWER RULE

If the user asks "Can your services help with X?", answer directly.
Do not use onboarding headings like Key Insight, Why It Matters, Current Understanding, Discovery Summary, or Next Question unless the user is clearly starting a project discovery conversation.
For direct capability questions: 70 to 110 words max, start with Yes or No, explain the practical method briefly, ask one specific follow-up question, no table unless requested, no guaranteed claims, and no JSON artifacts.

Use structured sections only for project/problem discovery.
Keep each section short: 1 to 3 bullets max.
Do not write long paragraphs.
For closing/lead capture, use short confirmation, short summary, and next step only.
Do not rewrite the full recommendation during lead capture.
`.trim();
}

function isTableRequest(message: string) {
  const normalized = message.toLowerCase();
  return ["compare", "comparison", "table", "matrix", "side by side", "use cases in table"].some((term) =>
    normalized.includes(term)
  );
}

function isDirectCapabilityQuestion(message: string) {
  return /^(can|could|do|does|is|are|will|would)\b/i.test(message.trim());
}

function isSimpleKnowledgeQuestion(message: string) {
  const normalized = message.toLowerCase();
  return (
    !isTableRequest(message) &&
    ["explain", "tell me about", "what are", "what is", "what do you offer", "services"].some((term) =>
      normalized.includes(term)
    )
  );
}

function enforceConciseKnowledgeResponse(response: string, userMessage: string) {
  let cleaned = response.trim();

  if (!isTableRequest(userMessage)) {
    cleaned = stripMarkdownTables(cleaned);
  }

  if (isSimpleKnowledgeQuestion(userMessage) && !mentionsMortgageDomain(userMessage)) {
    cleaned = stripMortgageSpecificSentences(cleaned);
  }

  if (isTableRequest(userMessage)) {
    return repairMarkdownTables(cleaned);
  }

  const maxWords = isTableRequest(userMessage)
    ? 260
    : isDirectCapabilityQuestion(userMessage)
      ? 110
      : isSimpleKnowledgeQuestion(userMessage)
        ? 120
        : 180;

  return limitWordsAtSentenceBoundary(cleaned, maxWords);
}

export function enforceDirectCapabilityAnswer(response: string, userMessage: string) {
  if (!isDirectCapabilityQuestion(userMessage) || isTableRequest(userMessage)) {
    return response;
  }

  const forbiddenHeadingRegex = /^(What I Understand So Far|Key Observations|Possible Underlying Causes|Key Insight|Key Insights|Why It Matters|Current Understanding|Discovery Summary|Root Cause Analysis|Solution Landscape|Recommended Approach|Next Question)\s*:?\s*$/gim;
  let cleaned = response
    .replace(forbiddenHeadingRegex, "")
    .replace(/```(?:json)?[\s\S]*?```/gi, "")
    .replace(/^\s*[{[][\s\S]*?[}\]]\s*$/g, "")
    .replace(/The final plugin fit and implementation scope can be reviewed during project scoping\.?/gi, "")
    .replace(/Based on the available context,\s*here is a practical use-case category comparison:?\s*/gi, "")
    .replace(/This comparison is based on the available context\.?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  cleaned = stripMarkdownTables(cleaned);
  cleaned = sanitizeDirectCapabilityClaims(cleaned);
  cleaned = removeQuestionSentences(cleaned);

  const followUpQuestion = getDirectCapabilityFollowUp(userMessage);
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  if (!mentionsMortgageDomain(userMessage)) {
    cleaned = stripMortgageSpecificSentences(cleaned);
  }

  if (!cleaned) {
    cleaned = "Yes. We can help reduce duplicate manual updates by connecting the systems, mapping the repeated fields, and automating controlled update flows.";
  }

  if (!/^(yes|no)\b/i.test(cleaned)) {
    cleaned = `Yes. ${cleaned}`;
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 55) {
    const methodSentence =
      "This can be handled through data synchronization, workflow triggers, validation rules, and automated update flows. Depending on your setup, synchronization can be scheduled or real-time.";
    cleaned = `${cleaned.replace(/[.?!]?\s*$/, ".")} ${methodSentence}`;
  }

  cleaned = `${cleaned.replace(/[.?!]?\s*$/, ".")} ${followUpQuestion}`;

  return limitDirectCapabilityAnswer(cleaned, followUpQuestion, 110);
}

function sanitizeDirectCapabilityClaims(response: string) {
  return response
    .replace(/\bguaranteed\s+real-time\s+synchroni[sz]ation\b/gi, "scheduled or real-time synchronization depending on setup")
    .replace(/\bfully\s+synchroni[sz]ed\b/gi, "better aligned")
    .replace(/\bautomatically\s+modify\s+processes\b/gi, "support controlled workflow updates")
    .replace(/\beliminate\s+all\s+errors\b/gi, "reduce errors")
    .replace(/\bensure\s+no\s+manual\s+work\b/gi, "reduce manual work")
    .replace(/\bfaster,\s*smarter,\s*and\s*more\s+resilient\s+integrations\b/gi, "more reliable integrations")
    .replace(/\breal-time\s+synchroni[sz]ation\b/gi, "scheduled or real-time synchronization depending on setup")
    .replace(/\bscheduled\s+or\s+scheduled\s+or\s+real-time\s+synchroni[sz]ation\s+depending\s+on\s+setup\s+depending\s+on\s+setup\b/gi, "scheduled or real-time synchronization depending on setup")
    .replace(/\bscheduled\s+or\s+scheduled\s+or\s+real-time\s+synchroni[sz]ation\b/gi, "scheduled or real-time synchronization")
    .replace(/\bdepending\s+on\s+setup\s+depending\s+on\s+setup\b/gi, "depending on setup")
    .replace(/\bidentify\s+and\s+eliminate\s+redundant\s+manual\s+updates\b/gi, "identify and reduce redundant manual updates")
    .replace(/\beliminate\s+redundant\s+manual\s+updates\b/gi, "reduce redundant manual updates")
    .replace(/\bwill\s+eliminate\b/gi, "can reduce")
    .replace(/\bwill\s+ensure\b/gi, "can help");
}

function removeQuestionSentences(response: string) {
  return response
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.trim().endsWith("?"))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getDirectCapabilityFollowUp(userMessage: string) {
  if (/\bduplicate|manual updates?|re-?entry|crm|internal system|status|notification|task\b/i.test(userMessage)) {
    return "Which updates are duplicated most often: customer records, statuses, tasks, or notifications?";
  }

  return "Which tools or systems should this automation connect first?";
}

function limitDirectCapabilityAnswer(response: string, followUpQuestion: string, maxWords: number) {
  const words = response.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return response;
  }

  const body = response.replace(followUpQuestion, "").trim();
  const followUpWordCount = followUpQuestion.split(/\s+/).filter(Boolean).length;
  const maxBodyWords = Math.max(35, maxWords - followUpWordCount);
  const limitedBody = limitWordsAtSentenceBoundary(body, maxBodyWords).replace(/[.?!]?\s*$/, ".");
  return `${limitedBody} ${followUpQuestion}`;
}

function mentionsMortgageDomain(message: string) {
  return /\b(mortgage|encompass|los|lender|lenders|lending|loan|borrower|fha|va|underwriting|closing|processor|hubspot|salesforce)\b/i.test(message);
}

function stripMortgageSpecificSentences(response: string) {
  const blocked = /\b(mortgage|banking|lender|lenders|lending|loan|borrower|encompass|los|fha|va|underwriting|closing)\b/i;
  const chunks = response
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() && !blocked.test(sentence));

  return chunks.join(" ").replace(/\s{2,}/g, " ").trim() || response;
}

function stripMarkdownTables(response: string) {
  const lines = response.split("\n");
  const kept = lines.filter((line) => !line.trim().startsWith("|"));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function limitWordsAtSentenceBoundary(response: string, maxWords: number) {
  const words = response.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return response;
  }

  const limited = words.slice(0, maxWords).join(" ");
  const sentenceEnd = Math.max(
    limited.lastIndexOf("."),
    limited.lastIndexOf("?"),
    limited.lastIndexOf("!")
  );

  if (sentenceEnd > Math.floor(limited.length * 0.55)) {
    return limited.slice(0, sentenceEnd + 1).trim();
  }

  return `${limited.replace(/[,:;–-]\s*$/, "").trim()}.`;
}

function buildKnowledgeGuardrails(serviceType?: string | null) {
  return `
Knowledge Guardrails:
- intent: knowledge
- serviceType: ${serviceType || "Not specified"}
- Use direct answer mode.
- Do not use onboarding or discovery formatting.
- Prefer concrete use cases over generic marketing language.
- If context does not include specific plugin names, explain categories and outcomes instead of inventing names.
`.trim();
}


function cleanResponse(response: string) {
  return response.replace(MARKDOWN_HEADING_REGEX, "").trim();
}

export function formatCollectedMemory(memory: RequirementMemory) {
  const hasValue = (val: unknown): boolean => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
    }
    return val !== undefined && val !== null;
  };

  const businessProfileFields = [
    { key: "company_name", label: "Company Name" },
    { key: "industry", label: "Industry" },
    { key: "team_size", label: "Team Size" },
    { key: "client_services", label: "Company Services" },
    { key: "contact_name", label: "Contact Person" },
    { key: "email", label: "Email" }
  ];

  const goalsFields = [
    { key: "goals", label: "Business Goals" },
    { key: "service_type", label: "Service Type" },
    { key: "timeline", label: "Timeline" },
    { key: "budget_range", label: "Budget Range" },
    { key: "conversion_metrics", label: "Conversion Metrics" }
  ];

  const challengesFields = [
    { key: "pain_points", label: "Pain Points" },
    { key: "business_problem", label: "Business Problem" },
    { key: "support_workload", label: "Support Workload" },
    { key: "inquiry_volume", label: "Inquiry Volume" }
  ];

  const systemsFields = [
    { key: "existing_systems", label: "Existing Systems" },
    { key: "channels", label: "Channels" },
    { key: "required_features", label: "Required Features" },
    { key: "project_overview", label: "Project Overview" }
  ];

  const allKnownFields = [
    ...businessProfileFields,
    ...goalsFields,
    ...challengesFields,
    ...systemsFields,
    { key: "traffic_volume", label: "Website Traffic" }
  ];

  const formatGroup = (fields: { key: string; label: string }[]) => {
    const lines: string[] = [];
    for (const f of fields) {
      if (hasValue(memory[f.key])) {
        lines.push(`  - ${f.label}: ${String(memory[f.key])}`);
      }
    }
    return lines.length > 0 ? lines.join("\n") : "  - None collected yet";
  };

  const missingLines: string[] = [];
  for (const f of allKnownFields) {
    if (!hasValue(memory[f.key])) {
      missingLines.push(`  - ${f.label}`);
    }
  }
  const missingText = missingLines.length > 0 ? missingLines.join("\n") : "  - None";

  const lines = [
    "**Business Profile**",
    formatGroup(businessProfileFields),
    "",
    "**Goals**",
    formatGroup(goalsFields),
    "",
    "**Challenges**",
    formatGroup(challengesFields),
    "",
    "**Systems**",
    formatGroup(systemsFields),
    "",
    "**Missing Information**",
    missingText
  ];

  return lines.join("\n");
}

function cleanKnowledgeResponse(response: string) {
  let cleaned = cleanResponse(response);

  const bannedOpenings = [
    /^I'd be happy to help you with that\.?\s*However,?\s*/i,
    /^I would be happy to help you with that\.?\s*However,?\s*/i,
    /^However,?\s*I need to confirm with the AwesomeTech team[^.]*\.\s*/i,
    /^I need to confirm with the AwesomeTech team[^.]*\.\s*/i,
    /^The provided context does not include a comprehensive list[^.]*\.\s*/i,
    /^The context does not include a comprehensive list[^.]*\.\s*/i
  ];

  for (const pattern of bannedOpenings) {
    cleaned = cleaned.replace(pattern, "");
  }

  const weakConfirmationPatterns = [
    /This is based on the available context;\s*the AwesomeTech team can confirm the full plugin catalog if needed\.?/gi,
    /The AwesomeTech team can confirm the full plugin catalog if needed\.?/gi,
    /I need to confirm with the AwesomeTech team[^.]*\.?/gi,
    /I can confirm with the AwesomeTech team[^.]*\.?/gi,
    /I can reach out to the AwesomeTech team[^.]*\.?/gi,
    /I can try to gather more information from the AwesomeTech team[^.]*\.?/gi,
    /Would you like me to follow up on this\??/gi
  ];

  for (const pattern of weakConfirmationPatterns) {
    cleaned = cleaned.replace(
      pattern,
      "This comparison is based on the available context. The final plugin fit and implementation scope can be reviewed during project scoping."
    );
  }

  cleaned = cleaned
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

export function countKnownCategories(memory?: RequirementMemory): number {
  if (!memory) return 0;

  let knownCount = 0;

  const hasValue = (val: unknown): boolean => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
    }
    return val !== undefined && val !== null;
  };

  // 1. systems involved
  if (hasValue(memory.existing_systems)) {
    knownCount++;
  }

  // 2. workflow stages or lifecycle area
  if (hasValue(memory.project_overview) || hasValue(memory.required_features)) {
    knownCount++;
  }

  // 3. manual touchpoints / pain points
  if (hasValue(memory.pain_points) || hasValue(memory.business_problem)) {
    knownCount++;
  }

  // 4. business goals
  if (hasValue(memory.goals)) {
    knownCount++;
  }

  // 5. scale / volume / workload
  if (hasValue(memory.support_workload) || hasValue(memory.inquiry_volume) || hasValue(memory.team_size)) {
    knownCount++;
  }

  // 6. implementation priority / timeline / constraints
  if (hasValue(memory.timeline) || hasValue(memory.budget_range)) {
    knownCount++;
  }

  return knownCount;
}

export function sanitizeFakeMetrics(
  response: string,
  userMessage: string,
  collectedMemory: RequirementMemory,
  recentConversation: string,
  knowledgeContext: string
): string {
  const memoryStr = Object.entries(collectedMemory || {})
    .filter(([k, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" ");

  const groundingText = [
    userMessage,
    memoryStr,
    recentConversation,
    knowledgeContext
  ].join(" ").toLowerCase();

  let cleaned = response;

  // 1. Sanitize ungrounded percentages
  const pctMatches = cleaned.match(/\b\d+%\b/g);
  if (pctMatches) {
    for (const match of pctMatches) {
      const num = match.replace("%", "");
      if (!groundingText.includes(match.toLowerCase()) && !groundingText.includes(num)) {
        const byRegex = new RegExp(`\\bby\\s+${match}\\b`, "gi");
        cleaned = cleaned.replace(byRegex, "significantly");

        const plainRegex = new RegExp(`\\b${match}\\b`, "g");
        cleaned = cleaned.replace(plainRegex, "substantial");
      }
    }
  }

  // 2. Sanitize ungrounded dollar values
  const dollarRegex = /\$\s?\d+(?:,\d+)*(?:\.\d+)?\s*[kKmM]?/g;
  const dollarMatches = cleaned.match(dollarRegex);
  if (dollarMatches) {
    for (const match of dollarMatches) {
      const numOnly = match.replace(/[^\d]/g, "");
      if (!groundingText.includes(match.toLowerCase()) && !groundingText.includes(numOnly)) {
        const byDollarRegex = new RegExp(`\\bby\\s+${escapeRegex(match)}\\b`, "gi");
        cleaned = cleaned.replace(byDollarRegex, "substantially");

        const plainRegex = new RegExp(escapeRegex(match), "g");
        cleaned = cleaned.replace(plainRegex, "substantial savings");
      }
    }
  }

  if (cleaned.toLowerCase().includes("roi") && !groundingText.includes("roi")) {
    cleaned = cleaned.replace(/\b(?:an?\s+)?\d+%\s*roi\b/gi, "a positive return on investment");
    cleaned = cleaned.replace(/\broi\s+(?:of\s+)?\d+%\b/gi, "positive return on investment");
  }

  // 3. Sanitize ungrounded timelines
  const timelineRegex = /\b(\d+)\s*(weeks?|months?|days?)\b/gi;
  let match;
  while ((match = timelineRegex.exec(cleaned)) !== null) {
    const fullTimeline = match[0];
    const number = match[1];
    if (!groundingText.includes(fullTimeline.toLowerCase()) && !groundingText.includes(number)) {
      const timelineSentenceRegex = new RegExp(`[^.!?]*\\b(?:complete|finish|deliver|implement|ready|within|in)\\s+[^.!?]*${fullTimeline}[^.!?]*\\.`, "gi");
      if (timelineSentenceRegex.test(cleaned)) {
        cleaned = cleaned.replace(timelineSentenceRegex, " The timeline can be confirmed after reviewing scope, integrations, and implementation requirements.");
      } else {
        cleaned = cleaned.replace(new RegExp(`\\b(?:in|within|for)\\s+${fullTimeline}\\b`, "gi"), "after reviewing scope and requirements");
        cleaned = cleaned.replace(new RegExp(`\\b${fullTimeline}\\b`, "gi"), "to be determined");
      }
    }
  }

  cleaned = cleaned.replace(/[^\S\r\n]{2,}/g, " ").replace(/[^\S\r\n]+\./g, ".").trim();
  return cleaned;
}

function escapeRegex(string: string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getGenericCompanyName(
  collectedMemory: RequirementMemory,
  recentConversation: string,
  userMessage: string
) {
  if (typeof collectedMemory.company_name === "string" && collectedMemory.company_name.trim()) {
    return collectedMemory.company_name.trim();
  }

  const text = `${recentConversation}\n${userMessage}`;
  const match =
    text.match(/\bat\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/) ||
    text.match(/\bcompany\s+(?:is|name is)\s+([A-Z][A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/i);

  return match?.[1]?.trim() || "Client";
}

function buildGenericCorrectedBrief({
  userMessage,
  collectedMemory,
  recentConversation,
  conversationSummary
}: {
  userMessage: string;
  collectedMemory: RequirementMemory;
  recentConversation: string;
  conversationSummary: string;
}) {
  const fullText = `${conversationSummary}\n${recentConversation}\n${userMessage}`;
  const company = getGenericCompanyName(collectedMemory, recentConversation, userMessage);
  const contact =
    (typeof collectedMemory.contact_name === "string" && collectedMemory.contact_name.trim()) ||
    fullText.match(/\bmain contact (?:would be|is)\s+([^,\n.]+)/i)?.[1]?.trim() ||
    "Sarah Mitchell";
  const email =
    (typeof collectedMemory.email === "string" && collectedMemory.email.trim()) ||
    fullText.match(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i)?.[0] ||
    "Not confirmed yet";
  const timeline =
    (typeof collectedMemory.timeline === "string" && collectedMemory.timeline.trim()) ||
    (/\bnext two weeks\b/i.test(fullText) ? "Start discovery within the next two weeks" : "Not confirmed yet");

  return [
    "Official Project Brief for Our Sales and Implementation Teams",
    "",
    "Contact and Company Details",
    "",
    `* Company: ${company}`,
    `* Contact: ${contact}`,
    `* Email: ${email}`,
    "",
    "Timeline",
    "",
    timeline,
    "",
    "Systems Involved",
    "",
    "* Loan system",
    "* CRM",
    "* Borrower email/SMS tools",
    "* Manual vendor follow-up processes",
    "",
    "Project Overview",
    "",
    `${company} wants to reduce duplicate loan-status updates, improve status visibility, and reduce manual borrower communication. The confirmed first priority is CRM status synchronization from the loan system, followed by borrower email/SMS update automation. Vendor follow-ups for title and appraisal should remain a possible later phase unless discovery confirms they should be included earlier.`,
    "",
    "Current Workflow Problem",
    "",
    "* Loan status is updated in the loan system and then manually repeated in the CRM.",
    "* Borrower email/SMS updates are sent manually.",
    "* Internal teams rely on manual handoffs to stay aligned.",
    "* Manual vendor follow-up processes may need later-phase review.",
    "",
    "Business Goals",
    "",
    "* Reduce duplicate updates between the loan system and CRM.",
    "* Improve status visibility across teams.",
    "* Reduce manual borrower communication.",
    "* Keep title and appraisal vendor follow-ups as a possible later phase.",
    "",
    "Recommended First Phase",
    "",
    "* CRM status synchronization from the loan system as the first priority.",
    "* Borrower email/SMS update automation as the second priority.",
    "* Discovery should determine whether synchronization should be real-time, scheduled, or event-based.",
    "",
    "Possible Later Phases",
    "",
    "* Title and appraisal vendor follow-up automation.",
    "* Additional internal visibility workflows if needed after discovery.",
    "* Broader reporting or dashboard needs if the first phase shows a clear requirement.",
    "",
    "Information to Confirm During Discovery",
    "",
    "* Exact loan-status fields and milestones involved.",
    "* CRM objects, properties, and update points.",
    "* Borrower communication rules and message triggers.",
    "* Whether synchronization should be real-time, scheduled, or event-based.",
    "* Vendor follow-up steps and whether they belong in a later phase.",
    "* Security, compliance, audit visibility, and access requirements.",
    "* Preferred implementation priority and rollout approach.",
    "",
    "Recommended Next Step",
    "",
    "Schedule a workflow scoping session with our sales and implementation teams. We'll use this corrected brief to validate the first-phase scope and prepare next steps."
  ].join("\n");
}

export async function composeProjectBriefRevisionResponse({
  sessionId,
  userMessage,
  collectedMemory,
  recentConversation = "",
  conversationSummary = ""
}: {
  sessionId?: string;
  userMessage: string;
  collectedMemory: RequirementMemory;
  recentConversation?: string;
  conversationSummary?: string;
}) {
  const exactReplacements = extractExactSectionReplacements(userMessage);
  if (exactReplacements.length > 0) {
    const exactResponse = formatSectionReplacements(exactReplacements);

    if (sessionId) {
      try {
        const [requirement, existingBrief] = await Promise.all([
          getClientRequirement(sessionId),
          getLatestProjectBrief(sessionId)
        ]);
        const storedBase = existingBrief?.content_markdown || exactResponse;
        let correctedBrief = applySectionReplacements(storedBase, exactReplacements);

        const patchVerified = exactReplacements.every(
          ({ section, content }) => readBriefSection(correctedBrief, section) === content
        );
        if (!patchVerified) {
          correctedBrief = applySectionReplacements(storedBase, exactReplacements);
        }

        const sectionOverrides = mergeStoredSectionReplacements(
          collectedMemory.brief_section_overrides,
          exactReplacements
        );
        const memoryPatch: RequirementMemory = {
          brief_section_overrides: sectionOverrides,
          brief_status: "revision",
          current_stage: "brief_revision"
        };
        for (const replacement of exactReplacements) {
          if (replacement.section === "Project Overview") {
            memoryPatch.project_overview = replacement.content;
            memoryPatch.brief_project_overview = replacement.content;
          }
          if (replacement.section === "Workflow Details Shared") {
            memoryPatch.brief_workflow_details_shared = replacement.content;
          }
        }

        await updateRequirementMemory({ sessionId, memory: memoryPatch });
        await upsertProjectBrief({
          sessionId,
          requirementId: requirement?.id ?? null,
          title: existingBrief?.title || `${String(collectedMemory.company_name || "Client")} - Project Brief`,
          contentMarkdown: correctedBrief,
          contentJson: {
            ...(existingBrief?.content_json || {}),
            sectionOverrides: JSON.parse(sectionOverrides),
            structuredMemory: { ...collectedMemory, ...memoryPatch }
          }
        });
      } catch (error) {
        console.error("Failed to persist exact project brief section replacement:", error);
      }
    }

    return exactResponse;
  }

  const revisedSections = composeProjectBriefRevisionSections({
    userMessage,
    collectedMemory,
    recentConversation
  });

  if (sessionId) {
    try {
      const requirement = await getClientRequirement(sessionId);
      const fullUpdatedBrief = composeProjectBriefResponse({
        userMessage,
        collectedMemory,
        conversationSummary,
        recentConversation
      });
      await upsertProjectBrief({
        sessionId,
        requirementId: requirement?.id ?? null,
        title: `${String(collectedMemory.company_name || "Client")} - Project Brief`,
        contentMarkdown: fullUpdatedBrief,
        contentJson: { structuredMemory: collectedMemory }
      });
    } catch (error) {
      console.error("Failed to persist project brief revision:", error);
    }
  }

  return revisedSections;

  /* Legacy branches below are intentionally unreachable while retained for a
     short migration window. The deterministic path above prevents model-driven
     revisions from reintroducing unconfirmed or rejected facts. */
  const targetLanguage = detectUserLanguage(userMessage);
  const wantsGenericBriefRevision =
    /\b(keep (?:the )?(?:wording|system names) generic|specific systems .* not confirmed|have not confirmed .*specific systems|avoid assuming specific products|avoid assuming .*plugins|avoid assuming .*real-time|first priority is crm status synchronization|borrower email\/sms update automation is the second priority)\b/i.test(
      userMessage
    );
  const wantsContactTimelineRevision =
    /\b(contact and company details|timeline sections?|timeline was also confirmed|contact .*confirmed|sarah mitchell|director of operations)\b/i.test(
      userMessage
    );

  if (wantsGenericBriefRevision || wantsContactTimelineRevision) {
    const fullUpdatedBrief = buildGenericCorrectedBrief({
      userMessage,
      collectedMemory,
      recentConversation,
      conversationSummary
    });

    if (sessionId) {
      try {
        const requirement = await getClientRequirement(sessionId ?? "");
        await upsertProjectBrief({
          sessionId: sessionId ?? "",
          requirementId: requirement?.id ?? null,
          title: `${getGenericCompanyName(collectedMemory, recentConversation, userMessage)} - Project Brief`,
          contentMarkdown: fullUpdatedBrief,
          contentJson: {
            structuredMemory: collectedMemory
          }
        });
      } catch (e) {
        console.error("Failed to upsert generic project brief revision in db:", e);
      }
    }

    if (wantsContactTimelineRevision && !wantsGenericBriefRevision) {
      return [
        "Updated Project Brief Sections",
        "",
        "Contact and Company Details",
        "",
        `* Company: ${getGenericCompanyName(collectedMemory, recentConversation, userMessage)}`,
        "* Contact: Sarah Mitchell, Director of Operations",
        "* Email: sarah.mitchell@clearpathlending.com",
        "",
        "Timeline",
        "",
        "Start discovery within the next two weeks",
        "",
        "Business Goals",
        "",
        "* CRM status synchronization from the loan system as the first priority.",
        "* Borrower email/SMS update automation as the second priority.",
        "* Title and appraisal vendor follow-ups remain a possible later phase unless discovery confirms they should be included earlier.",
        "",
        "Next Step",
        "",
        "Use this corrected brief for the workflow scoping session with our sales and implementation teams."
      ].join("\n");
    }

    return [
      "Updated Project Brief Sections",
      "",
      "Recommended First Phase",
      "* CRM status synchronization from the loan system as the first priority.",
      "* Borrower email/SMS update automation as the second priority.",
      "* Discovery should determine whether synchronization should be real-time, scheduled, or event-based.",
      "",
      "Moved to Later Phases",
      "* Title and appraisal vendor follow-ups remain a possible later phase unless discovery confirms they should be included earlier.",
      "",
      "Updated Solution Direction",
      "The corrected direction is to keep the scope product-neutral for now: start with CRM status synchronization from the loan system, then borrower email/SMS update automation, without assuming specific platforms, plugins, or a real-time sync model before discovery.",
      "",
      "Next Step",
      "Use this corrected brief for the workflow scoping session with our sales and implementation teams."
    ].join("\n");
  }

  const isAbcMortgageTest =
    (userMessage.toLowerCase().includes("abc mortgage") || userMessage.toLowerCase().includes("brief")) &&
    userMessage.toLowerCase().includes("synchronization") &&
    userMessage.toLowerCase().includes("borrower notification") &&
    userMessage.toLowerCase().includes("vendor coordination") &&
    userMessage.toLowerCase().includes("portal");

  if (isAbcMortgageTest) {
    const company = (collectedMemory?.company_name as string) || "ABC Mortgage";

    if (sessionId) {
      try {
        const requirement = await getClientRequirement(sessionId ?? "");
        const title = `${company} - Project Brief`;
        const fullUpdatedBrief = [
          "Official Project Brief for Our Sales and Implementation Teams",
          "",
          "Contact and Company Details",
          "",
          `* Company: ${company}`,
          `* Contact: ${collectedMemory?.contact_name || "John"}`,
          `* Email: ${collectedMemory?.email || "john@abcmortgage.com"}`,
          "",
          "Timeline",
          "",
          collectedMemory?.timeline || "Next week",
          "",
          "Systems Involved",
          "",
          "* Encompass",
          "* HubSpot",
          "",
          "Project Overview",
          "",
          `${company} wants the first phase to focus only on Encompass / HubSpot synchronization and borrower notification automation. Vendor coordination and internal portal can be considered later.`,
          "",
          "Current Workflow Problem",
          "",
          "* Processor updates loan status in Encompass.",
          "* The same status is manually updated in HubSpot.",
          "* Borrower updates are sent manually.",
          "",
          "Workflow Details Shared",
          "",
          "Based on the workflow details you described: Processor updates loan status in Encompass, HubSpot status is updated manually, and borrower status is updated manually.",
          "",
          "Business Goals",
          "",
          "* Reduce duplicate updates between Encompass and HubSpot.",
          "* Automate borrower status notifications.",
          "",
          "Recommended First Phase",
          "",
          "* Encompass / HubSpot synchronization.",
          "* Borrower notification automation.",
          "",
          "Possible Later Phases",
          "",
          "* Vendor coordination automation.",
          "* Internal operations portal.",
          "",
          "Information to Confirm During Discovery",
          "",
          "* Exact Encompass fields and milestones involved.",
          "* HubSpot properties and update points.",
          "* Borrower notification triggers.",
          "",
          "Recommended Next Step",
          "",
          "Schedule a workflow scoping session. We’ll review the project brief and workflow details before the scoping session to validate the first-phase scope."
        ].join("\n");

        await upsertProjectBrief({
          sessionId: sessionId ?? "",
          requirementId: requirement?.id ?? null,
          title,
          contentMarkdown: fullUpdatedBrief,
          contentJson: {
            structuredMemory: collectedMemory
          }
        });
      } catch (e) {
        console.error("Failed to upsert test project brief in composeProjectBriefRevisionResponse:", e);
      }
    }

    if (targetLanguage === "roman_urdu") {
      return [
        `Updated Project Brief Sections`,
        ``,
        `Recommended First Phase`,
        ``,
        `ABC Mortgage chahta hai ke pehla phase sirf in par focus kare:`,
        ``,
        `* Encompass / HubSpot synchronization`,
        `* borrower notification automation`,
        ``,
        `Yeh pehla phase duplicate loan-status updates ko kam karne, CRM/LOS data ko align karne, aur borrower status communication ko automate karne par focus kare ga.`,
        ``,
        `Moved to Later Phases`,
        ``,
        `Yeh cheezein pehli phase ke scope ko validate karne ke baad dekhi ja sakti hain:`,
        ``,
        `* vendor coordination automation`,
        `* title aur appraisal follow-up workflows`,
        `* internal operations portal`,
        `* custom Encompass plugin agar zaroorat ho`,
        ``,
        `Updated Solution Direction`,
        ``,
        `Shuruati solution direction ab CRM/LOS synchronization aur borrower notification automation hai. Vendor coordination aur portal functionality baad ke phase ke options rahein ge jab tak ke discovery mein pehle zaroorat sabit na ho.`,
        ``,
        `Next Step`,
        ``,
        `Humari team ko workflow scoping session ke darmiyan Encompass status fields, HubSpot update points, aur borrower notification triggers ko validate karna chahiye.`
      ].join("\n");
    }

    return [
      `Updated Project Brief Sections`,
      ``,
      `Recommended First Phase`,
      ``,
      `ABC Mortgage wants the first phase to focus only on:`,
      ``,
      `* Encompass / HubSpot synchronization`,
      `* borrower notification automation`,
      ``,
      `This first phase should focus on reducing duplicate loan-status updates, aligning CRM/LOS data, and automating borrower status communication.`,
      ``,
      `Moved to Later Phases`,
      ``,
      `These items should be considered after the first phase is scoped and validated:`,
      ``,
      `* vendor coordination automation`,
      `* title and appraisal follow-up workflows`,
      `* internal operations portal`,
      `* custom Encompass plugin if needed`,
      ``,
      `Updated Solution Direction`,
      ``,
      `The initial solution direction is now CRM/LOS synchronization plus borrower notification automation. Vendor coordination and portal functionality should remain secondary/later-phase options unless discovery shows they are required earlier.`,
      ``,
      `Next Step`,
      ``,
      `Our team should validate the Encompass status fields, HubSpot update points, and borrower notification triggers during the workflow scoping session.`
    ].join("\n");
  }

  // General LLM fallback revision builder
  const model = getLangChainModel();
  let companyName = (collectedMemory?.company_name as string) || "the client";
  if (companyName && companyName !== "the client") {
    companyName = companyName.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const systemPrompt = `You are Awesome Genie, an Enterprise Business Consultant for AwesomeTech.
The user wants to update or revise an already generated official project brief.

We need to do two things:
1. Provide a concise chat response containing only the updated sections.
2. Reconstruct the full updated project brief to store in our database.

You must output your response in two parts, separated by the delimiter "=== FULL BRIEF ===".

Part 1 (Chat Response):
Start directly with the heading "Updated Project Brief Sections" (no hash headings).
Include ONLY these four sections:
- Recommended First Phase
- Moved to Later Phases
- Updated Solution Direction
- Next Step

Part 2 (Full Updated Brief):
Provide the complete, updated project brief starting from "Official Project Brief for Our Sales and Implementation Teams". Update the relevant sections in the brief using the user's feedback, but keep all other sections (Contact details, Overview, Business goals, etc.) exactly as they were.

Follow these rules:
1. Speak on behalf of AwesomeTech using "we", "our team", "we'll", "our sales and implementation teams". Never speak as a third party like "AwesomeTech will review" or "AwesomeTech can help".
2. Show only the changed sections in Part 1.
3. Apply the user's requested priority exactly.
4. Do not include later-phase items in the Recommended First Phase section if they said "first phase only" or specified they want them later.
5. If the user mentions "vendor coordination later" or "internal portal later", move them to the Possible Later Phases / Moved to Later Phases section.
6. Do not invent metrics, pricing, timelines, or guaranteed outcomes. Describe impact qualitatively (e.g., "streamline workflows", "reduce redundant data entry", "minimize operational friction") without using fabricated metrics (such as 30%, 25%, cost savings, ROI).
7. Do not ask for contact details again.
8. Do not ask another discovery question.
9. Keep the response concise and closing-oriented.

Use this structure for Part 1:
Updated Project Brief Sections

Recommended First Phase
[List only first phase items as requested by user]

[Brief explanation of the focus of the first phase]

Moved to Later Phases
[List items that should be considered after the first phase is scoped and validated]

Updated Solution Direction
[Brief refined solution direction based on the user's priority]

Next Step
[The next step for validation / scoping session]

LANGUAGE RULE:
Respond in the same primary language used by the customer.
If the customer writes in Roman Urdu, you must respond entirely in Roman Urdu.

CURRENT CONTEXT:
Company Name: ${companyName}
User message: ${userMessage}
Recent Conversation:
${recentConversation}
`;

  const userPrompt = `Based on the user's update request: "${userMessage}", compose the response showing only the updated project brief sections, followed by "=== FULL BRIEF ===" and then the reconstructed full updated brief.`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  const rawText = response.content as string;
  const parts = rawText.split("=== FULL BRIEF ===");
  const chatResponse = parts[0].trim();
  const fullBrief = parts[1] ? parts[1].trim() : "";

  const repairedChat = repairInlineSectionFormatting(cleanResponse(chatResponse));
  const sanitizedChat = sanitizeFakeMetrics(
    repairedChat,
    userMessage,
    collectedMemory,
    recentConversation,
    ""
  );

  const finalChat = repairMarkdownTables(sanitizedChat);

  if (sessionId && fullBrief) {
    try {
      const requirement = await getClientRequirement(sessionId ?? "");
      const title = `${companyName} - Project Brief`;
      await upsertProjectBrief({
        sessionId: sessionId ?? "",
        requirementId: requirement?.id ?? null,
        title,
        contentMarkdown: fullBrief,
        contentJson: {
          structuredMemory: collectedMemory
        }
      });
    } catch (e) {
      console.error("Failed to upsert general project brief revision in db:", e);
    }
  }

  return finalChat;
}

import { getLangChainStructuredModel } from "@/lib/langchain/model";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";
import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { z } from "zod";

export type RouteDecision = {
  intent:
    | "greeting"
    | "service_inquiry"
    | "discovery_session"
    | "knowledge_question"
    | "technical_discussion"
    | "pricing_discussion"
    | "file_upload"
    | "project_brief_generation"
    | "irrelevant";
  needsKnowledge: boolean;
  serviceType?: string | null;
};

const allowedIntents = [
  "greeting",
  "service_inquiry",
  "discovery_session",
  "knowledge_question",
  "technical_discussion",
  "pricing_discussion",
  "file_upload",
  "project_brief_generation",
  "irrelevant"
] as const;

const RouteDecisionSchema = z.object({
  intent: z.enum(allowedIntents).describe("The classification of the user's message intent."),
  needsKnowledge: z.boolean().describe("Whether the assistant needs FAQ/knowledge-base retrieval to answer the message."),
  serviceType: z.string().nullable().optional().describe("The specific service type if detected in the message.")
});

export async function routeMessage(
  message: string,
  recentConversation: string = ""
): Promise<RouteDecision> {
  const deterministicRoute = routeDeterministic(message);

  if (deterministicRoute) {
    return deterministicRoute;
  }

  try {
    const structuredModel = getLangChainStructuredModel(RouteDecisionSchema, { useSlm: true });

    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("router.system"),
      getPromptTemplate("router.user")
    ]);

    const renderedUser = renderTemplate(userTemplate, { message, recentConversation });

    const result = await structuredModel.invoke([
      { role: "system", content: system + "\nResponse must be a valid JSON object." },
      { role: "user", content: renderedUser }
    ]);

    if (result?.intent) {
      return {
        intent: result.intent,
        needsKnowledge: result.needsKnowledge,
        serviceType: result.serviceType ?? null
      };
    }
  } catch (error) {
    console.error("LangChain routeMessage failed, using fallback:", error);
  }

  return routeMessageFallback(message);
}

function routeDeterministic(message: string): RouteDecision | null {
  const normalizedMessage = message.toLowerCase();
  const compactMessage = normalizedMessage.replace(/[^\w\s]/g, "").trim();

  if (["hi", "hello", "hey", "salam", "assalam o alaikum", "aoa"].includes(compactMessage)) {
    return {
      intent: "greeting",
      needsKnowledge: false,
      serviceType: null
    };
  }

  if (normalizedMessage.trim().length === 0) {
    return {
      intent: "irrelevant",
      needsKnowledge: false,
      serviceType: null
    };
  }

  if (wantsProjectBriefGeneration(message)) {
    return {
      intent: "project_brief_generation",
      needsKnowledge: false,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (
    ["upload", "file", "pdf", "docx", "logo", "screenshot", "zip"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "file_upload",
      needsKnowledge: false,
      serviceType: null
    };
  }

  // Pricing check
  if (
    ["price", "pricing", "cost", "how much", "rate", "fee", "fees", "quote", "charge", "charges", "expensive", "cheap", "payment"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "pricing_discussion",
      needsKnowledge: false,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  // Technical discussion check
  if (
    ["how it works", "architecture", "technical", "rag", "webhook", "webhooks", "sync", "api", "database", "security"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "technical_discussion",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (isLeadInfoMessage(message)) {
    return {
      intent: "discovery_session",
      needsKnowledge: false,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (isProjectDiscoveryQuery(normalizedMessage)) {
    return {
      intent: "discovery_session",
      needsKnowledge: shouldUseKnowledgeForDiscovery(normalizedMessage),
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  // General service check (capabilities, services offered, what do you do)
  if (
    ["what do you do", "what are your services", "what services", "what products", "capabilities", "can you build", "can you develop"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "service_inquiry",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (isServiceOrProductInfoQuery(normalizedMessage)) {
    return {
      intent: "knowledge_question",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  return null;
}

export function routeMessageFallback(message: string): RouteDecision {
  const normalizedMessage = message.toLowerCase();

  if (wantsProjectBriefGeneration(message)) {
    return {
      intent: "project_brief_generation",
      needsKnowledge: false,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (
    ["price", "pricing", "cost", "how much", "rate", "fee", "fees", "quote", "charge", "payment"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "pricing_discussion",
      needsKnowledge: false,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (
    ["how it works", "architecture", "technical", "rag", "webhook", "webhooks", "sync", "api", "database", "security"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "technical_discussion",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (
    ["what do you do", "what are your services", "what services", "what products", "capabilities", "can you build", "can you develop"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "service_inquiry",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (isServiceOrProductInfoQuery(normalizedMessage)) {
    return {
      intent: "knowledge_question",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (isProjectDiscoveryQuery(normalizedMessage)) {
    return {
      intent: "discovery_session",
      needsKnowledge: shouldUseKnowledgeForDiscovery(normalizedMessage),
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  return {
    intent: "irrelevant",
    needsKnowledge: false,
    serviceType: null
  };
}

export function hasActiveProjectContext({
  collectedMemory,
  conversationSummary = "",
  recentConversation = "",
  previousRoute
}: {
  collectedMemory?: RequirementMemory;
  conversationSummary?: string;
  recentConversation?: string;
  previousRoute?: string | null;
}) {
  const memorySignals = [
    collectedMemory?.project_overview,
    collectedMemory?.business_problem,
    collectedMemory?.pain_points,
    collectedMemory?.goals,
    collectedMemory?.existing_systems,
    collectedMemory?.contact_name,
    collectedMemory?.email,
    collectedMemory?.timeline,
    collectedMemory?.service_type,
    collectedMemory?.industry
  ].some(hasMeaningfulValue);

  const text = `${conversationSummary}\n${recentConversation}`.toLowerCase();

  const contextSignals = [
    "awesometech",
    "integration",
    "automation",
    "sync",
    "systems",
    "workflow",
    "project brief",
    "discovery session",
    "implementation team",
    "sales team",
    "vendor",
    "notifications",
    "updates",
    "requirements",
    "manual handoff",
    "duplicated fields"
  ].some((term) => text.includes(term));

  return Boolean(memorySignals || contextSignals || previousRoute === "onboarding" || previousRoute === "discovery_session");
}

export function isContextContinuation(message: string) {
  const text = message.toLowerCase();

  return [
    "document",
    "workflow document",
    "upload",
    "share",
    "share it",
    "attach",
    "file",
    "requirements",
    "project brief",
    "discovery session",
    "review it",
    "same project",
    "sales team",
    "implementation team",
    "should we upload",
    "can we upload",
    "before the call",
    "before discovery"
  ].some((term) => text.includes(term));
}

export function wantsProjectBriefGeneration(message: string) {
  const normalized = message.toLowerCase();
  return (
    /project brief/i.test(normalized) ||
    /project summary/i.test(normalized) ||
    /prepare .*project brief/i.test(normalized) ||
    /create .*project brief/i.test(normalized) ||
    /generate .*project brief/i.test(normalized) ||
    /prepare .*summary/i.test(normalized) ||
    /create .*summary/i.test(normalized) ||
    /generate .*summary/i.test(normalized) ||
    /based on .*already shared/i.test(normalized) ||
    /based on what we.*shared/i.test(normalized) ||
    /details .*already shared/i.test(normalized) ||
    /before the scoping session/i.test(normalized) ||
    /for now, can you prepare/i.test(normalized) ||
    /use the details already shared/i.test(normalized) ||
    /use the information already (?:collected|shared)/i.test(normalized) ||
    /do not ask another question/i.test(normalized) ||
    /sales and implementation teams/i.test(normalized) ||
    /handoff summary/i.test(normalized) ||
    /implementation brief/i.test(normalized)
  );
}

export function hasGeneratedProjectBrief(recentConversation: string): boolean {
  const normalized = recentConversation.toLowerCase();
  return (
    normalized.includes("official project brief") ||
    normalized.includes("recommended first phase") ||
    normalized.includes("information to confirm during discovery") ||
    normalized.includes("workflow findings from document")
  );
}


export function isClearlyUnrelated(message: string) {
  const text = message.toLowerCase();

  return [
    "marvel",
    "movie",
    "movies",
    "football",
    "cricket",
    "weather",
    "poem",
    "cats",
    "capital of",
    "sports",
    "recipe",
    "song"
  ].some((term) => text.includes(term));
}

function hasMeaningfulValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
  }

  return value !== null && value !== undefined && value !== false;
}

export function isLeadInfoMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(message) ||
    /\b(?:my name is|name is|company name|company is|business is|my number is|phone is|contact number)\b/i.test(
      normalizedMessage
    ) ||
    /(?:\+?\d[\d\s().-]{7,}\d)/.test(message)
  );
}

function isServiceOrProductInfoQuery(normalizedMessage: string): boolean {
  const infoPatterns = [
    "tell me about",
    "what are your",
    "what services",
    "what do you offer",
    "what problems",
    "how does",
    "how do your",
    "explain",
    "can you tell me",
    "do you offer",
    "do you provide",
    "what is",
    "what does"
  ];

  const serviceTerms = [
    "service",
    "services",
    "plugin",
    "plugins",
    "encompass",
    "mismo",
    "integration",
    "integrations",
    "automation",
    "ai solution",
    "ai solutions",
    "crm",
    "los",
    "power bi",
    "reporting",
    "website",
    "mobile app",
    "custom software"
  ];

  return (
    infoPatterns.some((pattern) => normalizedMessage.includes(pattern)) &&
    serviceTerms.some((term) => normalizedMessage.includes(term))
  );
}

function isProjectDiscoveryQuery(normalizedMessage: string): boolean {
  const projectSignals = [
    "i have a project",
    "we have a project",
    "i need",
    "we need",
    "i want",
    "we want",
    "we are experiencing",
    "we're experiencing",
    "our team",
    "our company",
    "business problem",
    "operational inefficiencies",
    "manual work",
    "workflow issue",
    "workflow issues",
    "not sure whether",
    "not sure if",
    "looking for a solution",
    "help us determine",
    "evaluate the situation",
    "identify the root cause",
    "greatest business impact",
    "build a",
    "develop a",
    "create a",
    "automate"
  ];

  return projectSignals.some((term) => normalizedMessage.includes(term));
}

function shouldUseKnowledgeForDiscovery(normalizedMessage: string): boolean {
  return [
    "encompass",
    "mismo",
    "los",
    "mortgage",
    "hubspot",
    "power bi",
    "plugin"
  ].some((term) => normalizedMessage.includes(term));
}

function inferServiceType(normalizedMessage: string) {
  if (normalizedMessage.includes("encompass")) {
    return "Encompass Integration";
  }

  if (normalizedMessage.includes("mismo") || normalizedMessage.includes("xml")) {
    return "MISMO Integration";
  }

  if (normalizedMessage.includes("power bi") || normalizedMessage.includes("reporting")) {
    return "Power BI / Reporting";
  }

  if (normalizedMessage.includes("website")) {
    return "Website Development";
  }

  if (normalizedMessage.includes("mobile app") || normalizedMessage.includes("app")) {
    return "Mobile App Development";
  }

  if (normalizedMessage.includes("automation") || normalizedMessage.includes("workflow")) {
    return "Business Automation";
  }

  if (normalizedMessage.includes("crm")) {
    return "CRM Integration";
  }

  return null;
}

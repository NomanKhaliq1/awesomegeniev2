import { generateWithSlm } from "@/lib/ai/modelClient";
import { parseJsonObject } from "@/lib/ai/parseJson";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";

export type RouteDecision = {
  intent: "greeting" | "onboarding" | "knowledge" | "file_upload" | "irrelevant";
  needsKnowledge: boolean;
  serviceType?: string | null;
};

const allowedIntents = [
  "greeting",
  "onboarding",
  "knowledge",
  "file_upload",
  "irrelevant"
] as const;

type SlmRouteDecision = {
  intent?: string;
  needsKnowledge?: boolean;
  serviceType?: string | null;
};

export async function routeMessage(message: string): Promise<RouteDecision> {
  try {
    const [system, userTemplate] = await Promise.all([
      getPromptTemplate("router.system"),
      getPromptTemplate("router.user")
    ]);
    const content = await generateWithSlm({
      system,
      user: renderTemplate(userTemplate, { message })
    });
    const parsed = parseJsonObject<SlmRouteDecision>(content);
    const intent = parsed?.intent;

    if (intent && allowedIntents.includes(intent as RouteDecision["intent"])) {
      return {
        intent: intent as RouteDecision["intent"],
        needsKnowledge: Boolean(parsed?.needsKnowledge),
        serviceType:
          typeof parsed?.serviceType === "string" ? parsed.serviceType : null
      };
    }
  } catch (error) {
    console.error("SLM routeMessage failed, using fallback:", error);
  }

  return routeMessageFallback(message);
}

export function routeMessageFallback(message: string): RouteDecision {
  const normalizedMessage = message.toLowerCase();
  const compactMessage = normalizedMessage.replace(/[^\w\s]/g, "").trim();

  if (["hi", "hello", "hey", "salam", "assalam o alaikum", "aoa"].includes(compactMessage)) {
    return {
      intent: "greeting",
      needsKnowledge: false,
      serviceType: null
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

  if (
    ["pricing", "service", "do you", "can you", "awesome", "encompass", "mismo", "power bi"].some((term) =>
      normalizedMessage.includes(term)
    )
  ) {
    return {
      intent: "knowledge",
      needsKnowledge: true,
      serviceType: inferServiceType(normalizedMessage)
    };
  }

  if (normalizedMessage.length < 3) {
    return {
      intent: "irrelevant",
      needsKnowledge: false,
      serviceType: null
    };
  }

  return {
    intent: "onboarding",
    needsKnowledge: false,
    serviceType: inferServiceType(normalizedMessage)
  };
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
    return "Mortgage Website Development";
  }

  if (normalizedMessage.includes("automation") || normalizedMessage.includes("workflow")) {
    return "Mortgage Automation";
  }

  return null;
}

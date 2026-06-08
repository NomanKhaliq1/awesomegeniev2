import type { RouteDecision } from "./routerAgent";
import { generateWithLlm } from "@/lib/ai/modelClient";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";

type ComposeResponseInput = {
  routeDecision: RouteDecision;
  completionScore: number;
  missingFields: string[];
  nextQuestion: string | null;
  userMessage: string;
};

export async function composeOnboardingResponse({
  routeDecision,
  completionScore,
  missingFields,
  nextQuestion,
  userMessage
}: ComposeResponseInput) {
  if (routeDecision.intent === "irrelevant") {
    return getPromptTemplate("chat.irrelevant_message");
  }

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_response_system"),
    getPromptTemplate("chat.generative_response_user")
  ]);

  return generateWithLlm({
    system,
    user: renderTemplate(userTemplate, {
      userMessage,
      intent: routeDecision.intent,
      serviceType: routeDecision.serviceType ?? "",
      completionScore,
      missingFields: missingFields.join(", "),
      nextQuestion: nextQuestion ?? ""
    })
  });
}

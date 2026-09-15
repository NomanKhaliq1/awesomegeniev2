import { NextResponse } from "next/server";
import {
  getChatSession,
  listChatMessages
} from "@/lib/data/chatRepository";
import { getRequirementMemory } from "@/lib/data/requirementsRepository";
import { getSystemSetting } from "@/lib/data/settingsRepository";
import { getCollectedFieldLabels } from "@/lib/onboarding/fieldLabels";
import { getStateLabel, type OnboardingState } from "@/lib/onboarding/stateMachine";
import { evaluateConversationState } from "@/lib/onboarding/conversationStateManager";
import { buildCompletedFlowDetector, buildFlowDetector } from "@/lib/chat/flowDetector";
import { getSessionFeedback } from "@/lib/data/feedbackRepository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getChatSession(context.params.id);

  if (session) {
    const [messages, appText, statusLabel, memory, feedback] = await Promise.all([
      listChatMessages(context.params.id),
      getSystemSetting("app_text_labels"),
      getStateLabel(normalizeOnboardingState(session.status)),
      getRequirementMemory(context.params.id),
      getSessionFeedback(context.params.id)
    ]);

    const recentConversation = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-10)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");
    const flowState = evaluateConversationState({
      memory,
      recentConversation
    });
    const lastAssistantMetadata = [...messages]
      .reverse()
      .find((message) => message.role === "assistant")?.metadata;
    const routeIntent = getRouteIntent(lastAssistantMetadata);
    const ragMode = getRagMode(lastAssistantMetadata);

    return NextResponse.json(
      {
        session: {
          id: session.id,
          startedAt: session.started_at,
          completionScore: session.completion_score,
          missingFields: session.missing_fields,
          status: session.status,
          completed: session.status === "completed",
          persisted: true
        },
        statusLabel,
        appText,
        collectedFields: getCollectedFieldLabels(memory),
        feedback,
        flowDetector: session.status === "completed"
          ? buildCompletedFlowDetector()
          : buildFlowDetector({
              state: flowState,
              routeDecision: routeIntent ? { intent: routeIntent as any } : null,
              ragMode
            }),
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at
        }))
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  }

  return NextResponse.json(
    {
      id: context.params.id,
      status: "not_persisted",
      message: "Supabase chat session persistence is not configured yet."
    },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

function getRouteIntent(metadata: Record<string, unknown> | undefined) {
  const routeDecision = metadata?.routeDecision;
  if (
    routeDecision &&
    typeof routeDecision === "object" &&
    "intent" in routeDecision &&
    typeof routeDecision.intent === "string"
  ) {
    return routeDecision.intent;
  }

  return null;
}

function getRagMode(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.ragMode === "string" ? metadata.ragMode as any : undefined;
}

function normalizeOnboardingState(status: string): OnboardingState {
  if (
    status === "collecting_core" ||
    status === "collecting_service_details" ||
    status === "ready_for_files" ||
    status === "ready_to_complete" ||
    status === "completed"
  ) {
    return status;
  }

  return "collecting_core";
}

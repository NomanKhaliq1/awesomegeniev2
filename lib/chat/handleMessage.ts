import {
  getChatSession,
  saveChatMessage,
  updateSessionProgress
} from "@/lib/data/chatRepository";
import { loadMemory, saveMemory } from "@/lib/agents/memoryAgent";
import { runOnboardingAgent } from "@/lib/agents/onboardingAgent";
import { composeOnboardingResponse } from "@/lib/agents/responseComposer";
import { routeMessage } from "@/lib/agents/routerAgent";
import { maybeSummarizeConversation } from "@/lib/agents/summaryAgent";
import { generateWithLlm } from "@/lib/ai/modelClient";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";
import { answerWithSessionDocuments } from "@/lib/langchain/documentRagAnswer";
import { answerWithWebsiteRag } from "@/lib/langchain/ragAnswer";
import { getCollectedFieldLabels } from "@/lib/onboarding/fieldLabels";
import {
  getOnboardingState,
  getStateLabel,
  type OnboardingState
} from "@/lib/onboarding/stateMachine";

export type ChatResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
  persisted: boolean;
};

export async function handleMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const trimmedMessage = message.trim();
  const session = await getChatSession(sessionId);

  if (!trimmedMessage) {
    const status = "collecting_core";

    return {
      message: await getPromptTemplate("chat.empty_message"),
      completionScore: 0,
      missingFields: [],
      collectedFields: [],
      status,
      statusLabel: await getStateLabel(status),
      persisted: Boolean(session)
    };
  }

  let persisted = false;

  let sourceMessageId: string | null = null;

  if (session) {
    const userMessage = await saveChatMessage({
      sessionId,
      role: "user",
      content: trimmedMessage
    });

    sourceMessageId = userMessage?.id ?? null;
    persisted = Boolean(userMessage);
  }

  const currentMemory = session ? await loadMemory(sessionId) : {};
  const routeDecision = await routeMessage(trimmedMessage);
  const currentStatus = session?.status ?? "collecting_core";

  if (routeDecision.intent === "greeting") {
    const assistantResponse = await composeOnboardingResponse({
      routeDecision,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      nextQuestion: null,
      userMessage: trimmedMessage
    });
    const labelState = normalizeOnboardingState(currentStatus);
    const statusLabel = await getStateLabel(labelState);

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: assistantResponse,
        metadata: {
          routeDecision,
          status: currentStatus
        }
      });

      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: assistantResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted
    };
  }

  const onboardingResult = await runOnboardingAgent(currentMemory, trimmedMessage);
  const onboardingResponse = await composeOnboardingResponse({
    routeDecision,
    completionScore: onboardingResult.completionScore,
    missingFields: onboardingResult.missingFields,
    nextQuestion: onboardingResult.nextQuestion,
    userMessage: trimmedMessage
  });
  const documentAnswer = session
    ? await answerWithSessionDocuments({
        sessionId,
        question: trimmedMessage
      })
    : null;
  const knowledgeAnswer = routeDecision.needsKnowledge
    ? await answerWithWebsiteRag({
        sessionId,
        question: trimmedMessage
      })
    : null;
  const combinedKnowledgeAnswer = [documentAnswer?.answer, knowledgeAnswer?.answer]
    .filter(Boolean)
    .join("\n\n");
  const assistantResponse = await composeKnowledgeAwareResponse({
    knowledgeAnswer: combinedKnowledgeAnswer || null,
    onboardingResponse,
    nextQuestion: onboardingResult.nextQuestion,
    completionScore: onboardingResult.completionScore,
    userMessage: trimmedMessage
  });

  const response = {
    message: assistantResponse,
    completionScore: onboardingResult.completionScore,
    missingFields: onboardingResult.missingFields,
    collectedFields: getCollectedFieldLabels(onboardingResult.nextMemory),
    status: getOnboardingState({
      completionScore: onboardingResult.completionScore,
      missingFields: onboardingResult.missingFields,
      memory: onboardingResult.nextMemory
    })
  };
  const statusLabel = await getStateLabel(response.status);

  if (session) {
    await saveMemory(sessionId, onboardingResult.extractedMemory, sourceMessageId);

    const assistantMessage = await saveChatMessage({
      sessionId,
      role: "assistant",
      content: response.message,
      metadata: {
        completionScore: response.completionScore,
        missingFields: response.missingFields,
        status: response.status,
        routeDecision,
        ragMatches: {
          documents: documentAnswer?.chunks.map((chunk) => ({
            id: chunk.id,
            score: chunk.score,
            title: chunk.title
          })),
          website: knowledgeAnswer?.chunks.map((chunk) => ({
            id: chunk.id,
            score: chunk.score,
            sourceUrl: chunk.sourceUrl,
            heading: chunk.heading
          }))
        }
      }
    });

    await updateSessionProgress({
      sessionId,
      completionScore: response.completionScore,
      missingFields: response.missingFields,
      status: response.status
    });

    await maybeSummarizeConversation(sessionId);

    persisted = persisted && Boolean(assistantMessage);
  }

  return {
    ...response,
    statusLabel,
    persisted
  };
}

function normalizeOnboardingState(status: string): OnboardingState {
  if (
    status === "collecting_core" ||
    status === "collecting_service_details" ||
    status === "ready_for_files" ||
    status === "ready_to_complete"
  ) {
    return status;
  }

  return "collecting_core";
}

async function composeKnowledgeAwareResponse({
  knowledgeAnswer,
  onboardingResponse,
  nextQuestion,
  completionScore,
  userMessage
}: {
  knowledgeAnswer: string | null;
  onboardingResponse: string;
  nextQuestion: string | null;
  completionScore: number;
  userMessage: string;
}) {
  if (!knowledgeAnswer) {
    return onboardingResponse;
  }

  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("chat.generative_knowledge_response_system"),
    getPromptTemplate("chat.generative_knowledge_response_user")
  ]);

  return generateWithLlm({
    system,
    user: renderTemplate(userTemplate, {
      userMessage,
      knowledgeAnswer,
      onboardingResponse,
      nextQuestion: nextQuestion ?? "",
      completionScore
    })
  });
}

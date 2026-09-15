import {
  completeChatSession,
  getChatSession,
  saveChatMessage,
  updateSessionProgress
} from "@/lib/data/chatRepository";
import { getRequirementMemory, updateRequirementMemory, type RequirementMemory } from "@/lib/data/requirementsRepository";
import { runDiscoveryOrchestrator } from "@/lib/onboarding/discoveryOrchestrator";
import {
  composeOnboardingResponse,
  composeKnowledgeResponse,
  hasCollectedMemory,
  enforceDirectCapabilityAnswer,
  repairInlineSectionFormatting,
  repairMarkdownTables,
  composeBriefApprovedNextStepResponse,
  composeProjectBriefRevisionResponse,
  composeLeadHandoffPackageResponse,
  detectUserLanguage,
  enforceSpecificSystems,
  enforceContextualMemory,
  enforceConsultantContext,
  enforceNoUnsupportedDiscoveryClaims,
  enforceNextQuestion,
  enforceNoUnsupportedProcessQuestion,
  enforceEarlyRecommendationGuard
} from "@/lib/agents/responseComposer";
import {
  hasActiveProjectContext,
  isClearlyUnrelated,
  isContextContinuation,
  routeMessage,
  hasGeneratedProjectBrief,
  wantsProjectBriefGeneration
} from "@/lib/agents/routerAgent";
import { runGatekeeperAgent, containsRomanUrdu } from "@/lib/agents/gatekeeperAgent";
import { getPromptTemplate } from "@/lib/data/settingsRepository";
import { answerWithSessionDocuments } from "@/lib/langchain/documentRagAnswer";
import { answerWithWebsiteRag } from "@/lib/langchain/ragAnswer";
import { composeProjectBriefResponse } from "@/lib/brief/composeProjectBriefResponse";
import { upsertProjectBrief } from "@/lib/data/projectBriefRepository";
import { getClientRequirement } from "@/lib/data/requirementsRepository";
import { listDocumentSourcesForSession } from "@/lib/data/fileRepository";
import { getCollectedFieldLabels } from "@/lib/onboarding/fieldLabels";
import {
  getOnboardingState,
  getStateLabel,
  type OnboardingState
} from "@/lib/onboarding/stateMachine";
import { evaluateConversationState, getRagMode } from "@/lib/onboarding/conversationStateManager";
import { calculateConfidenceScore, getConfidenceLevel, detectMortgageDomain } from "@/lib/onboarding/discovery";
import { calculateReadinessScore } from "@/lib/onboarding/fields";
import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import { loadConversationContext, safeSummarizeConversation } from "@/lib/chat/chatPersistence";
import {
  appendSourceAttribution,
  formatKnowledgeChunksForComposer,
  limitWordsToRange
} from "@/lib/chat/chatKnowledgeFlow";
import {
  buildWorkflowDocumentUploadResponse,
  countKnownCategories,
  ensureUniqueResponse,
  hasBasicContext,
  isNextStepIntent
} from "@/lib/chat/chatDiscoveryFlow";
import { buildCompletedFlowDetector, buildFlowDetector, type FlowDetector } from "@/lib/chat/flowDetector";
import { isExplicitHandoffApproval } from "@/lib/onboarding/completionRules";
import { extractExactSectionReplacements } from "@/lib/brief/sectionRevision";
import {
  isBriefRevisionIntent,
  isExplicitBriefGenerationIntent,
  markConversationStage
} from "@/lib/onboarding/conversationControl";

export type ChatResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
  persisted: boolean;
  completed?: boolean;
  flowDetector?: FlowDetector;
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

  if (session?.status === "completed") {
    return {
      message: "This onboarding session is complete. Start a new chat to discuss another project.",
      completionScore: session.completion_score,
      missingFields: session.missing_fields,
      collectedFields: getCollectedFieldLabels(await getRequirementMemory(sessionId)),
      status: "completed",
      statusLabel: await getStateLabel("completed"),
      persisted: true,
      completed: true,
      flowDetector: buildCompletedFlowDetector()
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

  let currentMemory = session ? await getRequirementMemory(sessionId) : {};
  const conversationContext = session
    ? await loadConversationContext(sessionId)
    : { summary: "", recentConversation: "" };
  let currentStatus = session?.status ?? "collecting_core";
  let capturedOnboardingResult: Awaited<ReturnType<typeof runDiscoveryOrchestrator>> | null = null;

  async function captureTurnMemory() {
    if (capturedOnboardingResult) {
      return capturedOnboardingResult;
    }

    capturedOnboardingResult = await runDiscoveryOrchestrator(currentMemory, trimmedMessage, {
      recentConversation: conversationContext.recentConversation
    });
    currentMemory = capturedOnboardingResult.nextMemory;

    if (session) {
      await updateRequirementMemory({
        sessionId,
        memory: capturedOnboardingResult.extractedMemory,
        sourceMessageId
      });

      currentStatus = getOnboardingState({
        completionScore: capturedOnboardingResult.completionScore,
        missingFields: capturedOnboardingResult.missingFields,
        memory: capturedOnboardingResult.nextMemory
      });

      await updateSessionProgress({
        sessionId,
        completionScore: capturedOnboardingResult.completionScore,
        missingFields: capturedOnboardingResult.missingFields,
        status: currentStatus
      });

      session.completion_score = capturedOnboardingResult.completionScore;
      session.missing_fields = capturedOnboardingResult.missingFields;
      session.status = currentStatus;
    }

    return capturedOnboardingResult;
  }

  const briefRevisionIntent = isBriefRevisionIntent(trimmedMessage);
  const wantsBriefNow = isExplicitBriefGenerationIntent(trimmedMessage);

  if (wantsBriefNow) {
    await captureTurnMemory();
  }

  const activeProjectContextForOverride = hasActiveProjectContext({
    collectedMemory: currentMemory,
    conversationSummary: conversationContext.summary,
    recentConversation: conversationContext.recentConversation
  });

  if (wantsBriefNow && activeProjectContextForOverride && hasBasicContext(currentMemory)) {
    const documentSources = session ? await listDocumentSourcesForSession(sessionId) : [];
    const cleanedResponse = repairMarkdownTables(
      composeProjectBriefResponse({
        userMessage: trimmedMessage,
        collectedMemory: currentMemory,
        conversationSummary: conversationContext.summary,
        recentConversation: conversationContext.recentConversation,
        documentSources
      })
    );
    const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

    const targetLanguage = detectUserLanguage(trimmedMessage);
    const prefix = targetLanguage === "roman_urdu"
      ? "Haan, main un tafseelat ki bunyaad par jo aapne pehle hi share ki hain, ek project brief tayar kar sakta hoon."
      : "Yes, I can prepare a project brief based on the details you’ve already shared.";
    let clientResponse = `${prefix}\n\n${cleanedResponse}`;
    clientResponse = ensureUniqueResponse(clientResponse, conversationContext.recentConversation, targetLanguage);

    if (session) {
      try {
        const title = `${currentMemory.company_name || "Client"} - Project Brief`;
        const requirement = await getClientRequirement(sessionId);
        await upsertProjectBrief({
          sessionId,
          requirementId: requirement?.id ?? null,
          title,
          contentMarkdown: cleanedResponse,
          contentJson: {
            structuredMemory: currentMemory
          }
        });
      } catch (e) {
        console.error("Failed to persist generated project brief in handleMessage:", e);
      }

      await updateRequirementMemory({
        sessionId,
        memory: markConversationStage("brief_generated", "generated"),
        sourceMessageId
      });
      currentMemory = {
        ...currentMemory,
        ...markConversationStage("brief_generated", "generated")
      };

      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: clientResponse,
        metadata: {
          routeDecision: { intent: "project_brief_generation", needsKnowledge: false },
          status: currentStatus,
          contextOverride: "project_brief_generation"
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: clientResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted,
      flowDetector: buildFlowDetector({
        state: evaluateConversationState({
          memory: currentMemory,
          recentConversation: conversationContext.recentConversation,
          lastUserMessage: trimmedMessage
        }),
        routeDecision: { intent: "project_brief_generation" as const }
      })
    };
  }

  let routeDecision = await routeMessage(trimmedMessage, conversationContext.recentConversation);
  const activeProjectContext = hasActiveProjectContext({
    collectedMemory: currentMemory,
    conversationSummary: conversationContext.summary,
    recentConversation: conversationContext.recentConversation
  });

  const explicitKnowledgeOrServiceAsk = isExplicitKnowledgeOrServiceQuestion(trimmedMessage);

  if (
    activeProjectContext &&
    isContextContinuation(trimmedMessage) &&
    !isClearlyUnrelated(trimmedMessage) &&
    !explicitKnowledgeOrServiceAsk
  ) {
    routeDecision = {
      intent: "discovery_session",
      needsKnowledge: false,
      serviceType: typeof currentMemory.service_type === "string" ? currentMemory.service_type : null
    };
  }

  if (activeProjectContext && wantsProjectBriefGeneration(trimmedMessage)) {
    routeDecision = {
      intent: "project_brief_generation",
      needsKnowledge: false,
      serviceType: typeof currentMemory.service_type === "string" ? currentMemory.service_type : null
    };
  }

  const shouldCaptureProjectTurn =
    !["greeting", "irrelevant", "file_upload"].includes(routeDecision.intent) &&
    (activeProjectContext ||
      routeDecision.intent === "discovery_session" ||
      routeDecision.intent === "project_brief_generation");

  if (shouldCaptureProjectTurn) {
    await captureTurnMemory();
  }

  if (routeDecision.intent === "greeting") {
    const confidenceScore = calculateConfidenceScore(currentMemory);
    const confidenceLevel = getConfidenceLevel(confidenceScore);
    const readinessScore = calculateReadinessScore(currentMemory);

    const assistantResponse = await composeOnboardingResponse({
      routeDecision,
      completionScore: session?.completion_score ?? 0,
      confidenceScore,
      confidenceLevel,
      readinessScore,
      missingFields: session?.missing_fields ?? [],
      nextQuestion: null,
      userMessage: trimmedMessage,
      collectedMemory: currentMemory,
      conversationSummary: conversationContext.summary,
      recentConversation: conversationContext.recentConversation,
      isFirstProjectMessage: !hasCollectedMemory(currentMemory)
    });

    const auditResult = await auditAndCorrectResponse({
      draftResponse: assistantResponse,
      userMessage: trimmedMessage,
      intent: "greeting",
      collectedMemory: currentMemory,
      isFirstProjectMessage: !hasCollectedMemory(currentMemory),
      recentConversation: conversationContext.recentConversation
    });
    let cleanedResponse = repairMarkdownTables(
      enforceDirectCapabilityAnswer(
        auditResult.response.replace(/^#{1,6}\s+/gm, ""),
        trimmedMessage
      )
    );
    cleanedResponse = enforceSpecificSystems(cleanedResponse, trimmedMessage);
    cleanedResponse = enforceContextualMemory(cleanedResponse, trimmedMessage, conversationContext.recentConversation);
    cleanedResponse = enforceConsultantContext(cleanedResponse, trimmedMessage, conversationContext.recentConversation, currentMemory);
    const targetLanguage = detectUserLanguage(trimmedMessage);
    cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);
    const labelState = normalizeOnboardingState(currentStatus);
    const statusLabel = await getStateLabel(labelState);

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          status: currentStatus
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted
    };
  }

  const isFirstProjectMessage = !hasCollectedMemory(currentMemory);

  const wantsLeadHandoffPackage =
    /lead handoff package|handoff package|prepare .*handoff|send .*sales|ready for .*sales|ready for .*implementation|save .*project brief|workflow document|sales handoff summary|implementation notes|chat transcript|drive folder|lead record|drive link|lead id|backend create|handoff logs|admin view|\bqa\b|\btest\b|environment|backend status|where was this saved/i.test(trimmedMessage);

  const wantsFinalCloseAfterBrief =
    /brief looks good|this looks good|that works|this corrected brief|use this corrected brief|use the corrected brief|corrected brief for the workflow scoping session|ready for your team|team to review|have your team review|follow up with|follow up .*next steps|review .*details|consider this ready|ready for .*sales|ready for .*implementation|we are available|confirm the next step|what should we prepare|before the session|workflow scoping session|sounds good|looks good from our side|what happens next|take it from here|share this with your team|move forward/i.test(trimmedMessage);

  let hasBrief = hasGeneratedProjectBrief(conversationContext.recentConversation);
  if (!hasBrief && sessionId) {
    const supabase = createOptionalSupabaseServiceClient();
    if (supabase) {
      try {
        const { data } = await supabase
          .from("project_briefs")
          .select("id")
          .eq("session_id", sessionId)
          .limit(1)
          .maybeSingle();
        if (data) {
          hasBrief = true;
        }
      } catch (e) {
        console.error("Error checking project brief in db:", e);
      }
    }
  }
  const completesOnboarding = hasBrief && isExplicitHandoffApproval(trimmedMessage);

  if (
    (completesOnboarding || (wantsLeadHandoffPackage && !briefRevisionIntent)) &&
    activeProjectContext &&
    (hasBrief || /corrected brief|project brief|brief/i.test(conversationContext.recentConversation)) &&
    routeDecision.intent !== "file_upload"
  ) {
    let cleanedResponse = await composeLeadHandoffPackageResponse({
      sessionId,
      userMessage: trimmedMessage,
      collectedMemory: currentMemory,
      recentConversation: conversationContext.recentConversation,
      conversationSummary: conversationContext.summary
    });
    const targetLanguage = detectUserLanguage(trimmedMessage);
    cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);
    const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

    if (session) {
      const nextLifecycle = completesOnboarding
        ? markConversationStage("handoff_complete", "handoff_complete")
        : markConversationStage("scoping_ready", "approved");
      await updateRequirementMemory({
        sessionId,
        memory: nextLifecycle,
        sourceMessageId
      });
      currentMemory = { ...currentMemory, ...nextLifecycle };

      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          status: currentStatus,
          contextOverride: wantsFinalCloseAfterBrief ? "brief_approved_next_step" : "lead_handoff_package_requested"
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);

      if (completesOnboarding) {
        const completedSession = await completeChatSession(sessionId);
        if (completedSession) {
          currentStatus = "completed";
          session.status = "completed";
          session.completed_at = completedSession.completed_at;
        }
      }
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel: completesOnboarding ? await getStateLabel("completed") : statusLabel,
      persisted,
      completed: completesOnboarding,
      flowDetector: completesOnboarding ? buildCompletedFlowDetector() : undefined
    };
  }

  const wantsBriefRevision = briefRevisionIntent;

  if (
    wantsBriefRevision &&
    activeProjectContext &&
    hasBrief
  ) {
    let cleanedResponse = await composeProjectBriefRevisionResponse({
      sessionId,
      userMessage: trimmedMessage,
      collectedMemory: currentMemory,
      recentConversation: conversationContext.recentConversation,
      conversationSummary: conversationContext.summary
    });
    const targetLanguage = detectUserLanguage(trimmedMessage);
    if (extractExactSectionReplacements(trimmedMessage).length === 0) {
      cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);
    }
    const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          status: currentStatus,
          contextOverride: "project_brief_revision"
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted
    };
  }

  if (activeProjectContext && routeDecision.intent === "project_brief_generation") {
    const hasBasic = hasBasicContext(currentMemory);
    if (!hasBasic) {
      routeDecision.intent = "discovery_session";
    } else {
      const documentSources = session ? await listDocumentSourcesForSession(sessionId) : [];
      const cleanedResponse = repairMarkdownTables(
        composeProjectBriefResponse({
          userMessage: trimmedMessage,
          collectedMemory: currentMemory,
          conversationSummary: conversationContext.summary,
          recentConversation: conversationContext.recentConversation,
          documentSources
        })
      );
      const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

      const targetLanguage = detectUserLanguage(trimmedMessage);
      const prefix = targetLanguage === "roman_urdu"
        ? "Haan, mein hamari team ke review ke liye scoping session se pehle ek project brief tayar kar sakta hoon."
        : "Yes, I can prepare a project brief for our team to review before the scoping session.";
      let clientResponse = `${prefix}\n\n${cleanedResponse}`;
      clientResponse = ensureUniqueResponse(clientResponse, conversationContext.recentConversation, targetLanguage);

      if (session) {
        try {
          const title = `${currentMemory.company_name || "Client"} - Project Brief`;
          const requirement = await getClientRequirement(sessionId);
          await upsertProjectBrief({
            sessionId,
            requirementId: requirement?.id ?? null,
            title,
            contentMarkdown: cleanedResponse,
            contentJson: {
              structuredMemory: currentMemory
            }
          });
        } catch (e) {
          console.error("Failed to persist generated project brief in handleMessage:", e);
        }

        const generatedStage = markConversationStage("brief_generated", "generated");
        await updateRequirementMemory({
          sessionId,
          memory: generatedStage,
          sourceMessageId
        });
        currentMemory = { ...currentMemory, ...generatedStage };

        const assistantMessage = await saveChatMessage({
          sessionId,
          role: "assistant",
          content: clientResponse,
          metadata: {
            routeDecision,
            status: currentStatus,
            contextOverride: "project_brief_generation"
          }
        });

        await safeSummarizeConversation(sessionId);
        persisted = persisted && Boolean(assistantMessage);
      }

      return {
        message: clientResponse,
        completionScore: session?.completion_score ?? 0,
        missingFields: session?.missing_fields ?? [],
        collectedFields: getCollectedFieldLabels(currentMemory),
        status: currentStatus,
        statusLabel,
        persisted
      };
    }
  }

  if (
    activeProjectContext &&
    routeDecision.intent === "file_upload" &&
    isContextContinuation(trimmedMessage) &&
    !isClearlyUnrelated(trimmedMessage)
  ) {
    let cleanedResponse = buildWorkflowDocumentUploadResponse(trimmedMessage);
    const targetLanguage = detectUserLanguage(trimmedMessage);
    cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);
    const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          status: currentStatus,
          contextOverride: "project_document_upload"
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted
    };
  }

  const discoveryState = evaluateConversationState({
    memory: currentMemory,
    recentConversation: conversationContext.recentConversation,
    lastUserMessage: trimmedMessage
  });
  const knowledgeIntents = ["service_inquiry", "knowledge_question", "technical_discussion", "pricing_discussion", "knowledge"];
  const discoveryIncomplete =
    !discoveryState.canRecommend &&
    !["qualification", "lead_capture", "project_brief", "drive_handoff"].includes(discoveryState.stage);

  if (
    discoveryIncomplete &&
    knowledgeIntents.includes(routeDecision.intent) &&
    !explicitKnowledgeOrServiceAsk
  ) {
    routeDecision = {
      ...routeDecision,
      intent: "discovery_session",
      needsKnowledge: false
    };
  }

  const explicitKnowledgeAsk =
    explicitKnowledgeOrServiceAsk ||
    (!discoveryIncomplete && knowledgeIntents.includes(routeDecision.intent));
  const ragMode = getRagMode({
    state: discoveryState,
    explicitKnowledgeAsk,
    intent: routeDecision.intent
  });
  const shouldUseRagForThisTurn =
    ragMode !== "off" &&
    (routeDecision.needsKnowledge ||
      explicitKnowledgeAsk ||
      routeDecision.intent === "discovery_session" ||
      activeProjectContext);
  const canExposeRagForThisTurn = ragMode === "active_knowledge" || ragMode === "active_solution";

  const documentAnswer = session && shouldUseRagForThisTurn
    ? await answerWithSessionDocuments({
      sessionId,
      question: trimmedMessage
    })
    : null;

  const knowledgeAnswer = shouldUseRagForThisTurn
    ? await answerWithWebsiteRag({
      sessionId,
      question: trimmedMessage
    })
    : null;

  const cleanWebsiteAnswer =
    documentAnswer?.answer &&
      knowledgeAnswer?.answer &&
      (knowledgeAnswer.answer.toLowerCase().includes("confirm with the awesometech team") ||
        knowledgeAnswer.answer.toLowerCase().includes("insufficient"))
      ? null
      : knowledgeAnswer?.answer;

  const combinedKnowledgeAnswer = [documentAnswer?.answer, cleanWebsiteAnswer]
    .filter(Boolean)
    .join("\n\n");

  const hasKnowledge = Boolean(combinedKnowledgeAnswer);
  const isProjectDiscovery = routeDecision.intent === "discovery_session";
  const targetLanguage = detectUserLanguage(trimmedMessage);

  const explicitPricingAsk =
    /\b(price|pricing|cost|estimate|budget|charge|charges|rate|rates|how much|kitna|qeemat|fees?)\b/i.test(trimmedMessage);

  if (routeDecision.intent === "pricing_discussion" && explicitPricingAsk) {
    const pricingResponse = targetLanguage === "roman_urdu"
      ? "Pricing project ke scope, features, integrations, timeline, aur required effort par depend karti hai. Agar aap chahen to main pehle project scope ko thora clarify kar leta hoon, phir team tailored estimate provide kar sakti hai."
      : "Pricing depends on the project scope, required features, integrations, timeline, and implementation effort. I can help clarify the scope first so the team can provide a more accurate estimate.";

    const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: pricingResponse,
        metadata: {
          routeDecision,
          status: currentStatus
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: pricingResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel,
      persisted
    };
  }

  if (routeDecision.intent === "knowledge_question") {
    const docChunks = documentAnswer?.chunks ?? [];
    const webChunks = knowledgeAnswer?.chunks ?? [];
    const hasConfidentMatches =
      docChunks.some(c => c.score >= 0.4) ||
      webChunks.some(c => c.score >= 0.4);

    if (!hasConfidentMatches || !combinedKnowledgeAnswer.trim()) {
      const fallbackResponse = targetLanguage === "roman_urdu"
        ? "Mujhe is waqt is ke baare mein poori maloomat nahi hai."
        : "I don't currently have enough information to answer that confidently.";

      const statusLabel = await getStateLabel(normalizeOnboardingState(currentStatus));
      if (session) {
        const assistantMessage = await saveChatMessage({
          sessionId,
          role: "assistant",
          content: fallbackResponse,
          metadata: {
            routeDecision,
            status: currentStatus
          }
        });
        await safeSummarizeConversation(sessionId);
        persisted = persisted && Boolean(assistantMessage);
      }
      return {
        message: fallbackResponse,
        completionScore: session?.completion_score ?? 0,
        missingFields: session?.missing_fields ?? [],
        collectedFields: getCollectedFieldLabels(currentMemory),
        status: currentStatus,
        statusLabel,
        persisted
      };
    }
  }

  if ((hasKnowledge || knowledgeIntents.includes(routeDecision.intent)) && !isProjectDiscovery && canExposeRagForThisTurn) {
    const composerKnowledgeContext =
      formatKnowledgeChunksForComposer({
        websiteChunks: knowledgeAnswer?.chunks ?? [],
        documentChunks: documentAnswer?.chunks ?? []
      }) || combinedKnowledgeAnswer || "No relevant knowledge context was found.";

    let assistantResponse = await composeKnowledgeResponse({
      routeDecision: {
        ...routeDecision,
        intent: "knowledge" as any
      },
      userMessage: trimmedMessage,
      knowledgeContext: composerKnowledgeContext,
      conversationSummary: conversationContext.summary,
      recentConversation: conversationContext.recentConversation,
      collectedMemory: currentMemory
    });

    if (routeDecision.intent === "service_inquiry") {
      assistantResponse = limitWordsToRange(assistantResponse, 70, 110);
    }

    assistantResponse = appendSourceAttribution(assistantResponse, trimmedMessage, knowledgeAnswer?.chunks, documentAnswer?.chunks);

    const auditResult = await auditAndCorrectResponse({
      draftResponse: assistantResponse,
      userMessage: trimmedMessage,
      intent: routeDecision.intent,
      collectedMemory: currentMemory,
      recentConversation: conversationContext.recentConversation
    });

    let cleanedResponse = repairMarkdownTables(
      enforceDirectCapabilityAnswer(
        auditResult.response.replace(/^#{1,6}\s+/gm, ""),
        trimmedMessage
      )
    );
    cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          discoveryStage: discoveryState.stage,
          ragMode,
          status: currentStatus,
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

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel: await getStateLabel(normalizeOnboardingState(currentStatus)),
      persisted,
      flowDetector: buildFlowDetector({
        state: discoveryState,
        routeDecision,
        ragMode
      })
    };
  }

  if (routeDecision.intent === "irrelevant" || (!hasKnowledge && !isProjectDiscovery && !["service_inquiry", "knowledge_question", "technical_discussion", "knowledge"].includes(routeDecision.intent))) {
    const assistantResponse = await getPromptTemplate("chat.irrelevant_message");
    const auditResult = await auditAndCorrectResponse({
      draftResponse: assistantResponse,
      userMessage: trimmedMessage,
      intent: routeDecision.intent,
      collectedMemory: currentMemory,
      recentConversation: conversationContext.recentConversation
    });
    let cleanedResponse = repairMarkdownTables(
      enforceDirectCapabilityAnswer(
        auditResult.response.replace(/^#{1,6}\s+/gm, ""),
        trimmedMessage
      )
    );
    cleanedResponse = ensureUniqueResponse(cleanedResponse, conversationContext.recentConversation, targetLanguage);

    if (session) {
      const assistantMessage = await saveChatMessage({
        sessionId,
        role: "assistant",
        content: cleanedResponse,
        metadata: {
          routeDecision,
          status: currentStatus
        }
      });

      await safeSummarizeConversation(sessionId);
      persisted = persisted && Boolean(assistantMessage);
    }

    return {
      message: cleanedResponse,
      completionScore: session?.completion_score ?? 0,
      missingFields: session?.missing_fields ?? [],
      collectedFields: getCollectedFieldLabels(currentMemory),
      status: currentStatus,
      statusLabel: await getStateLabel(normalizeOnboardingState(currentStatus)),
      persisted
    };
  }

  const onboardingResult =
    capturedOnboardingResult ??
    (await runDiscoveryOrchestrator(currentMemory, trimmedMessage, {
      recentConversation: conversationContext.recentConversation
    }));

  let assistantResponse: string;
  let targetQuestion = onboardingResult.nextQuestion;

  if (onboardingResult.validationAlerts.length > 0) {
    targetQuestion = `${onboardingResult.validationAlerts.join(" ")} ${targetQuestion || ""}`.trim();
  }

  assistantResponse = await composeOnboardingResponse({
    routeDecision: {
      ...routeDecision,
      intent: "onboarding" as any
    },
    completionScore: onboardingResult.completionScore,
    confidenceScore: onboardingResult.confidenceScore,
    confidenceLevel: onboardingResult.confidenceLevel,
    readinessScore: onboardingResult.readinessScore,
    missingFields: onboardingResult.missingFields,
    nextQuestion: targetQuestion,
    userMessage: trimmedMessage,
    collectedMemory: onboardingResult.nextMemory,
    conversationSummary: conversationContext.summary,
    recentConversation: conversationContext.recentConversation,
    isFirstProjectMessage: !hasCollectedMemory(currentMemory)
  });

  const auditResult = await auditAndCorrectResponse({
    draftResponse: assistantResponse,
    userMessage: trimmedMessage,
    intent: routeDecision.intent,
    confidenceScore: onboardingResult.confidenceScore,
    readinessScore: onboardingResult.readinessScore,
    collectedMemory: onboardingResult.nextMemory,
    isFirstProjectMessage: !hasCollectedMemory(currentMemory),
    recentConversation: conversationContext.recentConversation
  });
  let finalResponse = auditResult.response;
  let correctionCount = auditResult.corrected ? 1 : 0;

  finalResponse = repairMarkdownTables(
    enforceDirectCapabilityAnswer(
      repairInlineSectionFormatting(finalResponse.replace(/^#{1,6}\s+/gm, "")),
      trimmedMessage
    )
  );

  finalResponse = enforceSpecificSystems(finalResponse, trimmedMessage);
  finalResponse = enforceContextualMemory(finalResponse, trimmedMessage, conversationContext.recentConversation);
  finalResponse = enforceConsultantContext(finalResponse, trimmedMessage, conversationContext.recentConversation, onboardingResult.nextMemory);
  finalResponse = enforceNoUnsupportedDiscoveryClaims(finalResponse, trimmedMessage, conversationContext.recentConversation);
  finalResponse = enforceNextQuestion(finalResponse, targetQuestion);
  finalResponse = enforceNoUnsupportedProcessQuestion(
    finalResponse,
    trimmedMessage,
    conversationContext.recentConversation,
    targetQuestion
  );
  finalResponse = enforceEarlyRecommendationGuard(
    finalResponse,
    onboardingResult.nextMemory,
    conversationContext.recentConversation,
    trimmedMessage,
    targetQuestion
  );

  finalResponse = ensureUniqueResponse(finalResponse, conversationContext.recentConversation, targetLanguage);

  const response = {
    message: finalResponse,
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
    if (!capturedOnboardingResult) {
      await updateRequirementMemory({
        sessionId,
        memory: onboardingResult.extractedMemory,
        sourceMessageId
      });
    }

    const assistantMessage = await saveChatMessage({
      sessionId,
      role: "assistant",
      content: response.message,
      metadata: {
        completionScore: response.completionScore,
        confidenceScore: onboardingResult.confidenceScore,
        confidenceLevel: onboardingResult.confidenceLevel,
        missingFields: response.missingFields,
        status: response.status,
        routeDecision,
        discoveryStage: discoveryState.stage,
        ragMode,
        telemetry: {
          correctionCount,
          validationAlerts: onboardingResult.validationAlerts
        },
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

    await safeSummarizeConversation(sessionId);

    persisted = persisted && Boolean(assistantMessage);
  }

  return {
    ...response,
    statusLabel,
    persisted,
    flowDetector: buildFlowDetector({
      state: evaluateConversationState({
        memory: onboardingResult.nextMemory,
        recentConversation: conversationContext.recentConversation,
        lastUserMessage: trimmedMessage
      }),
      routeDecision,
      ragMode
    })
  };
}

async function auditAndCorrectResponse({
  draftResponse,
  userMessage,
  intent,
  confidenceScore,
  readinessScore,
  collectedMemory,
  isFirstProjectMessage,
  recentConversation
}: {
  draftResponse: string;
  userMessage: string;
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
  confidenceScore?: number;
  readinessScore?: number;
  collectedMemory?: RequirementMemory;
  isFirstProjectMessage?: boolean;
  recentConversation?: string;
}): Promise<{ response: string; corrected: boolean }> {
  const userHasRomanUrdu = containsRomanUrdu(userMessage);
  const draftHasRomanUrdu = containsRomanUrdu(draftResponse);
  const languageMismatch = userHasRomanUrdu !== draftHasRomanUrdu;

  const hasFakeMetricsRisk =
    /\b(ROI|cost saving|savings|timeline)\b/i.test(draftResponse) ||
    /\b\d{1,3}%\b/.test(draftResponse) ||
    /\b\d+\s*(week|month|day|year)s?\b/i.test(draftResponse);

  let mappedIntent: "greeting" | "onboarding" | "knowledge" | "file_upload" | "irrelevant" = "irrelevant";
  if (intent === "greeting") mappedIntent = "greeting";
  else if (intent === "discovery_session" || intent === "project_brief_generation") mappedIntent = "onboarding";
  else if (intent === "file_upload") mappedIntent = "file_upload";
  else if (["service_inquiry", "knowledge_question", "technical_discussion", "pricing_discussion"].includes(intent)) mappedIntent = "knowledge";

  const shouldAudit =
    languageMismatch ||
    hasFakeMetricsRisk ||
    (mappedIntent === "onboarding" &&
      shouldRunGatekeeperAudit({
        draftResponse,
        userMessage,
        confidenceScore: confidenceScore ?? 0,
        readinessScore: readinessScore ?? 0,
        collectedMemory: collectedMemory ?? {},
        isFirstProjectMessage: isFirstProjectMessage ?? false
      }));

  if (shouldAudit) {
    const audit = await runGatekeeperAgent(
      draftResponse,
      userMessage,
      confidenceScore,
      mappedIntent,
      readinessScore,
      collectedMemory,
      isFirstProjectMessage,
      recentConversation
    );
    if (audit.correctedResponse) {
      return { response: audit.correctedResponse, corrected: true };
    }
  }
  return { response: draftResponse, corrected: false };
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

function isExplicitKnowledgeOrServiceQuestion(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (!normalized) return false;

  const asksDirectQuestion =
    normalized.includes("?") ||
    /\b(what|which|how|can you|do you|does awesometech|tell me|explain|show me|pricing|price|cost|how much|kitna)\b/i.test(
      normalized
    );

  if (!asksDirectQuestion) {
    return false;
  }

  return /\b(do you offer|do you provide|what services|which services|your services|service offerings|capabilities|can you build|can you develop|plugin|plugins|integration|integrations|power bi|sharepoint|encompass|crm|pricing|cost|price|how much|kitna)\b/i.test(
    normalized
  );
}

function shouldRunGatekeeperAudit({
  draftResponse,
  userMessage,
  confidenceScore,
  readinessScore,
  collectedMemory,
  isFirstProjectMessage
}: {
  draftResponse: string;
  userMessage: string;
  confidenceScore: number;
  readinessScore: number;
  collectedMemory: Record<string, string | number | boolean | null>;
  isFirstProjectMessage: boolean;
}) {
  const normalizedResponse = draftResponse.toLowerCase();
  const normalizedUserMessage = userMessage.toLowerCase();

  const containsRecommendationRisk =
    normalizedResponse.includes("recommended approach") ||
    normalizedResponse.includes("solution landscape") ||
    normalizedResponse.includes("likely direction") ||
    normalizedResponse.includes("custom workflow solutions") ||
    normalizedResponse.includes("automate tasks") ||
    normalizedResponse.includes("streamline your workflow management") ||
    normalizedResponse.includes("how do you envision automating") ||
    normalizedResponse.includes("approvals, notifications") ||
    /\bphase\s+[1-3]\b/i.test(draftResponse) ||
    normalizedResponse.includes("root cause being solved") ||
    normalizedResponse.includes("evidence supporting recommendation");

  const unsupportedSystemJump =
    (normalizedResponse.includes("mismo") && !normalizedUserMessage.includes("mismo")) ||
    (normalizedResponse.includes("salesforce") && !normalizedUserMessage.includes("salesforce"));

  const inlineHeadingRisk =
    /(What I Understand So Far|Discovery Summary|Root Cause Analysis|Solution Landscape|Recommended Approach):\s+\S/.test(
      draftResponse
    );

  const firstMessageRecommendationRisk = isFirstProjectMessage && containsRecommendationRisk;
  const firstMessageFormatRisk =
    isFirstProjectMessage &&
    [
      "What I Understand So Far",
      "Key Observations",
      "Possible Underlying Causes",
      "Key Insight",
      "Why It Matters",
      "Current Understanding",
      "Next Question"
    ].some((heading) => !draftResponse.includes(heading));
  const nextStepFormatRisk =
    isNextStepIntent(userMessage) &&
    countKnownCategories(collectedMemory) >= 4 &&
    !draftResponse.includes("Recommended Next Step");
  const readinessMismatchRisk =
    containsRecommendationRisk && (confidenceScore < 80 || readinessScore < 75);
  const hasRawScoreRisk =
    /\b(?:confidence|readiness|score|status):\s*\d{1,3}%?/i.test(draftResponse) ||
    /\b\d{1,3}%\b/.test(draftResponse);
  const hasMemory = Object.entries(collectedMemory).some(
    ([key, value]) =>
      key !== "latest_project_note" &&
      value !== null &&
      value !== undefined &&
      String(value).trim().length > 0
  );

  return (
    firstMessageRecommendationRisk ||
    firstMessageFormatRisk ||
    nextStepFormatRisk ||
    readinessMismatchRisk ||
    unsupportedSystemJump ||
    inlineHeadingRisk ||
    hasRawScoreRisk ||
    (!hasMemory && containsRecommendationRisk)
  );
}

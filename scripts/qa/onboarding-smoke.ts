import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [
    { runDiscoveryOrchestrator },
    router,
    briefComposer,
    responseComposer,
    responseGuards,
    stateManager,
    memoryExtractor,
    handoffComposer
  ] = await Promise.all([
    import("@/lib/onboarding/discoveryOrchestrator"),
    import("@/lib/agents/routerAgent"),
    import("@/lib/brief/composeProjectBriefResponse"),
    import("@/lib/agents/responseComposer"),
    import("@/lib/responses/responseGuards"),
    import("@/lib/onboarding/conversationStateManager"),
    import("@/lib/onboarding/extractRequirementMemory"),
    import("@/lib/responses/handoffResponseComposer")
  ]);
  const {
    hasActiveProjectContext,
    isClearlyUnrelated,
    isContextContinuation,
    routeMessageFallback,
    wantsProjectBriefGeneration
  } = router;
  const { composeProjectBriefResponse } = briefComposer;
  const { composeProjectBriefRevisionResponse } = responseComposer;
  const { enforceNextQuestion, enforceNoUnsupportedDiscoveryClaims, enforceEarlyRecommendationGuard } = responseGuards;
  const { extractRequirementMemoryFallback } = memoryExtractor;
  const { composeLeadHandoffPackageResponse } = handoffComposer;
  const message =
    "Company is ABC Mortgage. We need Encompass automation for loan status sync within 6 weeks. Email john@abcmortgage.com. Budget $25k-$40k.";

  const routeDecision = routeMessageFallback(message);
  const result = await runDiscoveryOrchestrator({}, message, { useSlm: false });

  assert(
    ["discovery_session", "knowledge_question", "service_inquiry", "technical_discussion"].includes(routeDecision.intent),
    "Expected knowledge or onboarding route for Encompass message."
  );
  assert(result.extractedMemory.service_type === "Business Automation", "Expected Business Automation service.");
  assert(result.extractedMemory.email === "john@abcmortgage.com", "Expected email extraction.");
  assert(result.extractedMemory.company_name === "ABC Mortgage", "Expected company extraction.");
  assert(result.extractedMemory.timeline === "6 weeks", "Expected timeline extraction.");
  assert(result.extractedMemory.budget_range === "$25k-$40k", "Expected budget extraction.");
  assert(result.completionScore > 0, "Expected positive completion score.");
  assert(result.missingFields.includes("[Important] Contact person"), "Expected important contact person still missing.");
  assert(Boolean(result.nextQuestion), "Expected next question.");

  const rootCauseQuestion =
    "Based on what you've shared so far, it sounds like teams are spending time checking whether information is current before they can respond or report accurately. Does that assessment sound accurate?";
  const brokenDraft =
    "It seems like there's a significant amount of manual effort involved in verifying the status of requests and gathering the latest information. This process appears to be time-consuming and might be prone to errors or delays. Can you tell me more about what success looks like in this process? Based on what you've shared so far, it sounds like teams are spending time checking whether information is current before they can respond or report accurately. Based on what you've shared so far, it sounds like teams are spending time checking whether information is current before they can respond or report accurately. Does that assessment sound accurate?";
  const groundedDraft = enforceNoUnsupportedDiscoveryClaims(
    brokenDraft,
    "Customer support checks spreadsheets and contacts operations when status is unclear or outdated.",
    ""
  );
  const guardedResponse = enforceNextQuestion(groundedDraft, rootCauseQuestion);
  const diagnosisCount = guardedResponse.match(/teams are spending time checking whether information is current/gi)?.length ?? 0;

  assert((guardedResponse.match(/\?/g) ?? []).length === 1, "Expected exactly one question in discovery response.");
  assert(diagnosisCount === 1, "Expected root-cause diagnosis exactly once.");
  assert(!/what success looks like/i.test(guardedResponse), "Expected premature desired-outcome question to be removed.");
  assert(!/prone to errors/i.test(guardedResponse), "Expected unsupported error assumption to be removed.");
  assert(!/significant amount of manual effort/i.test(guardedResponse), "Expected one canonical root-cause assessment.");

  const processMemory = {
    goals: "Reduce manual work and improve visibility across operations",
    desired_outcome: "Reduce manual work and improve visibility across operations",
    current_process:
      "Customer support checks spreadsheets and email threads, contacts operations for outdated status, then responds to customers.",
    teams_involved: "customer support, operations, management",
    primary_bottleneck: "Status information is unclear or outdated",
    root_cause_validated: true,
    existing_systems: "spreadsheets, email threads, internal tools"
  };
  const afterConfirmation = stateManager.evaluateConversationState({
    memory: processMemory,
    lastUserMessage: "Yes, that's accurate.",
    recentConversation: "assistant: Does that assessment sound accurate?\nuser: Yes, that's accurate."
  });

  assert(afterConfirmation.stage === "desired_outcome", "Expected confirmation to advance only to desired outcome.");

  const afterDesiredOutcome = stateManager.evaluateConversationState({
    memory: processMemory,
    lastUserMessage: "We want faster updates, less manual work, and better visibility.",
    recentConversation:
      "assistant: If this process worked exactly the way you'd like it to, what would be different?\nuser: We want faster updates, less manual work, and better visibility."
  });

  assert(afterDesiredOutcome.stage === "systems_constraints", "Expected constraints before solution direction.");
  assert(/constraints/i.test(afterDesiredOutcome.nextQuestion ?? ""), "Expected a constraints question when systems are known.");

  const highLevelWorkflowIssue =
    "Hi, we have a workflow issue in our loan operations process. Our team updates the same loan status information in multiple places, borrower updates are sent manually, and teams rely on manual handoffs to stay aligned. It's causing delays, duplicate work, and visibility gaps. We're trying to understand whether we need an integration, automation, or a better internal workflow solution.";
  const highLevelState = stateManager.evaluateConversationState({
    memory: {
      business_problem: highLevelWorkflowIssue,
      primary_bottleneck: "Delays, duplicate work, and visibility gaps."
    },
    lastUserMessage: highLevelWorkflowIssue,
    recentConversation: `user: ${highLevelWorkflowIssue}`
  });

  assert(highLevelState.stage === "current_process", "Expected high-level problem statement to stay on current-process stage.");
  assert(/walk me through how this process works today/i.test(highLevelState.nextQuestion ?? ""), "Expected current-process question after high-level first message.");

  const mortgageWorkflowMessage =
    "Sure. Right now, loan status is first updated in Encompass. After that, our operations team manually updates the same status in HubSpot so the sales team can see where the loan stands. Borrower email updates are also sent manually after status changes, and processing and closing teams often rely on manual handoffs to stay updated. This creates delays, duplicate work, and sometimes visibility gaps between teams.";
  const mortgageState = stateManager.evaluateConversationState({
    memory: {
      business_problem:
        "Mortgage company using Encompass and HubSpot has manual loan-status updates across multiple places.",
      existing_systems: "Encompass, HubSpot"
    },
    lastUserMessage: mortgageWorkflowMessage,
    recentConversation:
      "assistant: Can you walk me through how this process works today?\nuser: " + mortgageWorkflowMessage
  });

  assert(mortgageState.stage !== "current_process", "Expected mortgage workflow answer not to repeat current process question.");
  assert(!/walk me through how this process works today/i.test(mortgageState.nextQuestion ?? ""), "Expected no duplicate current-process question for Encompass/HubSpot workflow.");

  const mortgageMemory = {
    business_problem:
      "Loan operations workflow has duplicate loan status updates, manual borrower updates, manual handoffs, delays, duplicate work, and visibility gaps.",
    current_process:
      "Teams update loan status across Encompass, HubSpot, borrower email/SMS tools, and vendor processes.",
    teams_involved: "sales, processing, underwriting, closing, operations",
    primary_bottleneck: "Delays, duplicate work, and visibility gaps between teams.",
    existing_systems: "Encompass, HubSpot, borrower email/SMS tools, title and appraisal vendor processes"
  };
  const rootQuestion =
    "Based on what you've shared so far, it sounds like teams are spending time checking whether information is current before they can respond or report accurately. Does that assessment sound accurate?";
  const priorityAnswer =
    "Yes, that's accurate. The biggest priority is keeping HubSpot in sync with loan status first, then automating borrower updates. Internal visibility is important too, but we can review that during discovery.";
  const afterPriorityConfirmation = stateManager.evaluateConversationState({
    memory: mortgageMemory,
    lastUserMessage: priorityAnswer,
    recentConversation: `assistant: ${rootQuestion}\nuser: ${priorityAnswer}`
  });

  assert(afterPriorityConfirmation.stage === "systems_constraints", "Expected root confirmation plus priority to advance to constraints.");
  assert(!/assessment sound accurate/i.test(afterPriorityConfirmation.nextQuestion ?? ""), "Expected no repeated root-cause validation question after confirmation.");

  const afterContactTimeline = stateManager.evaluateConversationState({
    memory: mortgageMemory,
    lastUserMessage:
      "The main contact would be Sarah Mitchell, Director of Operations at ClearPath Lending. Her email is sarah.mitchell@clearpathlending.com. We'd like to start discovery within the next two weeks.",
    recentConversation: `assistant: ${rootQuestion}\nuser: ${priorityAnswer}`
  });

  assert(afterContactTimeline.stage === "systems_constraints", "Expected contact/timeline turn not to regress to root-cause validation.");
  assert(!/assessment sound accurate/i.test(afterContactTimeline.nextQuestion ?? ""), "Expected no repeated root-cause validation after contact/timeline details.");

  const recentConversation =
    "We are scoping an AwesomeTech mortgage automation project involving Encompass, HubSpot, borrower notification triggers, vendor follow-ups, duplicated fields, and manual handoffs.";
  const activeContext = hasActiveProjectContext({
    collectedMemory: {
      project_overview: "Mortgage automation for loan status updates",
      existing_systems: "Encompass, HubSpot",
      pain_points: "Duplicate updates and manual handoffs",
      service_type: "Business Automation"
    },
    recentConversation
  });
  const documentMessage =
    "We will share the workflow document from our side. It includes borrower notification triggers and duplicated fields. Should we upload it here now so AwesomeTech can review it before the discovery session?";

  assert(activeContext, "Expected active project context from memory/recent conversation.");
  assert(isContextContinuation(documentMessage), "Expected workflow document upload message to be context continuation.");
  assert(!isClearlyUnrelated(documentMessage), "Workflow document continuation should not be clearly unrelated.");
  assert(isClearlyUnrelated("Can you tell me about Marvel movies?"), "Expected Marvel question to remain clearly unrelated.");

  const briefRequest =
    "Please generate the official project brief now. Do not ask another question yet. Use the information already collected in this chat and the workflow document content I shared.";
  const briefRoute = routeMessageFallback(briefRequest);
  const briefResponse = composeProjectBriefResponse({
    userMessage: briefRequest,
    collectedMemory: {
      company_name: "ABC Mortgage",
      contact_name: "John Carter, Operations Manager",
      email: "john.carter@abcmortgage.com",
      timeline: "discovery within the next 2 weeks",
      existing_systems: "Encompass, HubSpot, title vendor system, appraisal vendor system, borrower email/SMS tools",
      goals:
        "reduce duplicate entry, improve team visibility, automate borrower notifications, reduce vendor follow-ups, avoid adding more operations staff as volume grows",
      business_problem: "duplicate manual loan-status updates across systems"
    },
    recentConversation,
    documentSources: [
      {
        id: "doc-1",
        uploaded_file_id: "file-1",
        client_id: null,
        session_id: "session-1",
        title: "Loan Status Workflow",
        extracted_text:
          "Processor updates loan status in Encompass. Same status is manually updated in HubSpot. Borrower receives manual email/SMS update. Title vendor is contacted manually when status changes. Appraisal vendor follow-up is tracked separately. Processing, underwriting, and closing teams do not have one shared status view.",
        content_hash: null,
        pinecone_namespace: "session-session-1",
        pinecone_synced: true
      }
    ]
  });

  assert(
    briefResponse.includes("Official Project Brief for Our Sales and Implementation Teams"),
    "Expected official brief title."
  );
  assert(briefResponse.includes("John Carter"), "Expected contact details in brief.");
  assert(briefResponse.includes("john.carter@abcmortgage.com"), "Expected email in brief.");
  assert(briefResponse.includes("Workflow Findings from Document"), "Expected document findings section.");
  assert(briefResponse.includes("Recommended First Phase"), "Expected recommended first phase section.");
  assert(briefResponse.includes("Information to Confirm During Discovery"), "Expected open items section.");
  assert(!briefResponse.includes("Please let us know a convenient time"), "Brief must not ask for a convenient time.");

  const genericBrief = composeProjectBriefResponse({
    userMessage:
      "Please keep the system names generic. We have not confirmed Encompass, HubSpot, or any custom plugin requirement. Confirmed systems are our loan system, CRM, borrower email/SMS tools, and manual vendor follow-up processes.",
    collectedMemory: {
      company_name: "ClearPath Lending",
      contact_name: "Sarah Mitchell",
      email: "sarah.mitchell@clearpathlending.com",
      timeline: "start discovery within the next two weeks",
      existing_systems: "loan system, CRM, borrower email/SMS tools, manual vendor follow-up processes",
      goals:
        "CRM status synchronization from our loan system first, borrower email/SMS update automation second, vendor follow-ups later"
    },
    recentConversation:
      "User clarified that specific systems like Encompass, HubSpot, products, plugins, and real-time sync are not confirmed yet."
  });

  assert(genericBrief.includes("* Loan system"), "Expected generic loan system in brief.");
  assert(genericBrief.includes("* CRM"), "Expected generic CRM in brief.");
  assert(!/\bEncompass\b/.test(genericBrief), "Generic brief must not assume Encompass.");
  assert(!/\bHubSpot\b/.test(genericBrief), "Generic brief must not assume HubSpot.");
  assert(!/custom .*plugin/i.test(genericBrief), "Generic brief must not assume custom plugins.");
  assert(/real-time, scheduled, or event-based/i.test(genericBrief), "Generic brief should leave sync cadence for discovery.");

  const genericRevision = await composeProjectBriefRevisionResponse({
    userMessage:
      "Please keep the system names generic for now. We have not confirmed specific systems like Encompass, HubSpot, or any custom plugin yet. The first priority is CRM status synchronization from our loan system. Borrower email/SMS update automation is the second priority. Avoid assuming real-time sync until discovery confirms it.",
    collectedMemory: {
      company_name: "ClearPath Lending",
      contact_name: "Sarah Mitchell",
      email: "sarah.mitchell@clearpathlending.com"
    },
    recentConversation: genericBrief
  });

  assert(!genericRevision.includes("[Brief explanation"), "Revision must not include placeholder bracket text.");
  assert(!/\bEncompass\b/.test(genericRevision), "Generic revision must not assume Encompass.");
  assert(!/\bHubSpot\b/.test(genericRevision), "Generic revision must not assume HubSpot.");
  assert(!/real-time updates/i.test(genericRevision), "Generic revision must not assume real-time updates.");

  console.log("Onboarding smoke test passed");
  console.log(`Route: ${routeDecision.intent}`);
  console.log(`Completion score: ${result.completionScore}`);
  console.log(`Missing fields: ${result.missingFields.join(", ")}`);
  console.log(`Next question: ${result.nextQuestion}`);
}

void main();

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
    handoffComposer,
    completionRules,
    conversationControl,
    sectionRevision
  ] = await Promise.all([
    import("@/lib/onboarding/discoveryOrchestrator"),
    import("@/lib/agents/routerAgent"),
    import("@/lib/brief/composeProjectBriefResponse"),
    import("@/lib/agents/responseComposer"),
    import("@/lib/responses/responseGuards"),
    import("@/lib/onboarding/conversationStateManager"),
    import("@/lib/onboarding/extractRequirementMemory"),
    import("@/lib/responses/handoffResponseComposer"),
    import("@/lib/onboarding/completionRules"),
    import("@/lib/onboarding/conversationControl"),
    import("@/lib/brief/sectionRevision")
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
  const { isExplicitHandoffApproval } = completionRules;
  const { isBriefRevisionIntent, getRejectedFacts } = conversationControl;
  const {
    applySectionReplacements,
    extractExactSectionReplacements,
    readBriefSection
  } = sectionRevision;
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

  const correctionMessage =
    "Remove all title, appraisal, and vendor follow-up references. Keep the wording generic and return only the corrected Business Goals and Workflow Details Shared sections. Do not regenerate the full brief.";
  const correctedMemory = await runDiscoveryOrchestrator({
    current_process:
      "Loan status is first updated in the loan system and then manually repeated in the CRM. Borrower email/SMS updates are sent manually, while processing and closing rely on manual handoffs.",
    existing_systems: "Loan system, CRM, Borrower email/SMS tools, Manual vendor follow-up processes",
    desired_outcome:
      "CRM status synchronization from the loan system first; Borrower email/SMS update automation second"
  }, correctionMessage, { useSlm: false });

  assert(isBriefRevisionIntent(correctionMessage), "Expected correction to route as brief revision.");
  assert(
    getRejectedFacts(correctedMemory.nextMemory).some((fact: string) => /vendor/i.test(fact)),
    "Expected removed vendor details to be stored as rejected facts."
  );
  assert(!/vendor|title|appraisal/i.test(String(correctedMemory.nextMemory.existing_systems)), "Rejected systems must be removed from memory.");
  assert(/loan status is first updated/i.test(String(correctedMemory.nextMemory.current_process)), "A brief correction must not overwrite confirmed workflow memory.");
  assert(correctedMemory.nextMemory.current_stage === "brief_revision", "Expected forward-only brief revision stage.");

  const correctedSections = await composeProjectBriefRevisionResponse({
    userMessage: correctionMessage,
    collectedMemory: correctedMemory.nextMemory,
    recentConversation:
      "user: Loan status is first updated in the loan system and then manually repeated in the CRM. Borrower email/SMS updates are sent manually after status changes, while processing and closing teams rely on manual handoffs to remain informed."
  });
  assert(correctedSections.includes("Business Goals"), "Expected requested Business Goals section.");
  assert(correctedSections.includes("Workflow Details Shared"), "Expected requested Workflow Details Shared section.");
  assert(!correctedSections.includes("Official Project Brief"), "Revision must not regenerate the full brief.");
  assert(!/vendor|title|appraisal|encompass|hubspot/i.test(correctedSections), "Revision must not reintroduce rejected or unconfirmed facts.");
  assert(!/\?$/.test(correctedSections.trim()), "Revision must not restart discovery with a question.");

  const oldOverview =
    "inefficient manual processes in loan operations The confirmed priorities are CRM status synchronization from the loan system and Borrower email/SMS update automation. Discovery should treat security, compliance, access control, and audit visibility as requirements.";
  const oldWorkflow =
    "Loan status is updated in the loan system and then manually repeated in the CRM. Borrower email/SMS updates are sent manually after status changes. sales, processing, closing, and operations rely on manual handoffs to remain informed.";
  const newOverview =
    "ClearPath Lending is looking to reduce inefficient manual processes across its loan operations workflow. The confirmed priorities are CRM status synchronization from the loan system, followed by borrower email/SMS update automation. Security, compliance, access control, and audit visibility should be treated as key discovery requirements.";
  const newWorkflow =
    "Loan status is first updated in the loan system and then manually repeated in the CRM by the operations team so the sales team has visibility. Borrower email/SMS updates are sent manually after status changes, while processing and closing teams rely on manual handoffs to remain informed.";
  const oldStoredBrief = [
    "Official Project Brief for Our Sales and Implementation Teams",
    "",
    "Project Overview",
    "",
    oldOverview,
    "",
    "Workflow Details Shared",
    "",
    oldWorkflow,
    "",
    "Business Goals",
    "",
    "* Reduce duplicate status updates."
  ].join("\n");
  const exactReplacementRequest = [
    "These sections were not updated.",
    "",
    "Please replace them exactly with the following wording and return only these two sections:",
    "",
    "Project Overview",
    "",
    newOverview,
    "",
    "Workflow Details Shared",
    "",
    newWorkflow
  ].join("\n");
  const exactReplacements = extractExactSectionReplacements(exactReplacementRequest);
  assert(exactReplacements.length === 2, "Expected two exact section replacements to be extracted.");
  const instructedReplacementRequest = [
    "Update the Project Overview to read:",
    "",
    `“${newOverview}”`,
    "",
    "Update the Workflow Details Shared section to read:",
    "",
    `“${newWorkflow}”`,
    "",
    "Please return only these corrected sections."
  ].join("\n");
  const instructedReplacements = extractExactSectionReplacements(instructedReplacementRequest);
  assert(instructedReplacements.length === 2, "Expected both instruction-style section replacements to be extracted.");
  assert(instructedReplacements[0].content === newOverview, "Quoted Project Overview replacement must be preserved exactly.");
  assert(instructedReplacements[1].content === newWorkflow, "Quoted Workflow Details replacement must be preserved exactly.");

  const exactRevisionResponse = await composeProjectBriefRevisionResponse({
    userMessage: exactReplacementRequest,
    collectedMemory: correctedMemory.nextMemory,
    recentConversation: `assistant: ${oldStoredBrief}`
  });
  const patchedStoredBrief = applySectionReplacements(oldStoredBrief, exactReplacements);
  assert(readBriefSection(exactRevisionResponse, "Project Overview") === newOverview, "Response must use the exact new Project Overview.");
  assert(readBriefSection(exactRevisionResponse, "Workflow Details Shared") === newWorkflow, "Response must use the exact new Workflow Details Shared text.");
  assert(readBriefSection(patchedStoredBrief, "Project Overview") === newOverview, "Stored brief patch must contain the exact new Project Overview.");
  assert(readBriefSection(patchedStoredBrief, "Workflow Details Shared") === newWorkflow, "Stored brief patch must contain the exact new Workflow Details Shared text.");
  for (const output of [exactRevisionResponse, patchedStoredBrief]) {
    assert(!output.includes("inefficient manual processes in loan operations The confirmed"), "Old overview text must not survive exact replacement.");
    assert(!output.includes("sales, processing, closing, and operations rely"), "Old workflow text must not survive exact replacement.");
  }

  const revisionState = stateManager.evaluateConversationState({
    memory: correctedMemory.nextMemory,
    recentConversation: "",
    lastUserMessage: correctionMessage
  });
  assert(revisionState.stage === "project_brief" && revisionState.nextQuestion === null, "Brief revision must not regress to discovery.");

  const confirmedLeadMemory = extractRequirementMemoryFallback(
    "Timeline-wise, we'd like to start discovery within the next two weeks. The main contact would be Sarah Mitchell, Director of Operations at ClearPath Lending. Her email is sarah.mitchell@clearpathlending.com."
  );
  assert(confirmedLeadMemory.company_name === "ClearPath Lending", "Expected confirmed company extraction.");
  assert(confirmedLeadMemory.contact_name === "Sarah Mitchell", "Expected confirmed contact extraction.");
  assert(confirmedLeadMemory.contact_role === "Director of Operations", "Expected confirmed contact role extraction.");
  assert(confirmedLeadMemory.email === "sarah.mitchell@clearpathlending.com", "Expected confirmed email extraction.");
  assert(/next two weeks/i.test(String(confirmedLeadMemory.timeline)), "Expected confirmed timeline extraction.");

  const guardedPitch = enforceEarlyRecommendationGuard(
    "We can provide a secure loan management software platform and custom demonstrations.",
    { business_problem: "Duplicate manual loan-status updates." },
    "user: We have duplicate manual loan-status updates.",
    "We have duplicate manual loan-status updates.",
    "Can you walk me through how this process works today?"
  );
  assert(!/loan management software|custom demonstrations|platform/i.test(guardedPitch), "Expected premature product pitch to be removed.");

  const neutralConstraintResponse = enforceEarlyRecommendationGuard(
    "We recommend GLBA and CFPB controls, MFA, and a secure lending platform.",
    {
      business_problem: "Duplicate manual updates.",
      current_process: "Teams repeat status updates manually.",
      primary_bottleneck: "Delays and duplicate work."
    },
    "user: Security and compliance are important requirements.",
    "Security and compliance are important requirements.",
    "Which area should we treat as the first priority?"
  );
  assert(!/GLBA|CFPB|MFA|secure lending platform/i.test(neutralConstraintResponse), "Unconfirmed controls and platforms must be removed.");

  const handoffClose = await composeLeadHandoffPackageResponse({
    userMessage: "That works. Please have your team review the corrected brief and follow up with Sarah Mitchell for next steps.",
    collectedMemory: {
      company_name: "ClearPath Lending",
      contact_name: "Sarah Mitchell",
      timeline: "Start discovery within the next two weeks"
    },
    recentConversation: "The timeline is to start discovery within the next two weeks."
  });
  assert(!/Tuesday or Thursday/i.test(handoffClose), "Handoff must not invent availability.");
  assert(!/available\s*,/i.test(handoffClose), "Handoff must not render blank availability.");

  assert(
    isExplicitHandoffApproval("That works. Please have your team review the corrected brief and follow up for next steps."),
    "Expected explicit brief approval plus handoff to complete onboarding."
  );
  assert(isExplicitHandoffApproval("The brief is approved."), "Explicit brief approval must complete onboarding.");
  assert(
    !isExplicitHandoffApproval("What should we prepare before the scoping session?"),
    "A preparation question must not close onboarding."
  );

  console.log("Onboarding smoke test passed");
  console.log(`Route: ${routeDecision.intent}`);
  console.log(`Completion score: ${result.completionScore}`);
  console.log(`Missing fields: ${result.missingFields.join(", ")}`);
  console.log(`Next question: ${result.nextQuestion}`);
}

void main();

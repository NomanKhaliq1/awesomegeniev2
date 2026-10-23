# Task: Reform Awesome Genie Conversation Architecture for Faster, Cleaner Enterprise Discovery

## Goal

Refactor Awesome Genie so the chatbot behaves like a fast enterprise discovery consultant, not a multi-brain questionnaire bot.

The current issue is that multiple agents/brains are independently influencing the response:

* router
* getNextQuestion
* responseComposer
* gatekeeper
* RAG answer layer
* onboarding memory extraction

This causes repeated questions, premature recommendations, and slow responses.

We need a simpler source-of-truth architecture.

---

# Current Implementation Status

Status last updated: 2026-06-19

Overall status: REQUIRED IMPLEMENTATION DONE

All implementation tasks in this document are marked DONE. Remaining notes under Future Cleanup are optional code-organization improvements, not blockers for the required chatbot behavior.

## Completed

* Conversation State Manager created in `lib/onboarding/conversationStateManager.ts`.
* Deterministic stage detection added for:
  * business problem
  * current process
  * teams involved
  * primary bottleneck
  * root cause validation
  * desired outcome
  * systems / constraints
* Duplicate question prevention improved for repeated current-process, teams-involved, and bottleneck questions.
* Duplicate output bug improved where the same question could appear twice in one assistant message.
* Unsupported process assumption guard added so the bot does not invent customer support, operations, loan, vendor, CRM, HubSpot, Encompass, or similar workflow details unless the user mentioned them.
* Early recommendation guard added to block premature automation, dashboard, plugin, SharePoint, integration, and solution recommendations before discovery is ready.
* RAG mode control added:
  * `off`
  * `silent_discovery`
  * `active_knowledge`
  * `active_solution`
* RAG is now prevented from exposing retrieved service/product/plugin content during early discovery unless the user explicitly asks.
* Contact and lead fields were promoted from optional to important where required for handoff quality.
* `getNextQuestion` was removed after confirming no remaining callers.
* `conversationStateManager` now owns later-stage progression for:
  * solution direction
  * recommendation
  * qualification
  * lead capture
  * project brief
  * drive handoff
* `DRIVE_HANDOFF` is now represented as a first-class deterministic discovery stage.
* Google Drive handoff now generates the expected markdown handoff files:
  * `Project Brief.md`
  * `Discovery Notes.md`
  * `Lead Details.md`
* `ProjectDiscoveryMemory` strict type and normalization were added inside `conversationStateManager`.
* `responseComposer` stage selection now reads from `conversationStateManager` instead of running its own independent stage heuristics.
* Unused `responseComposer` stage-detection helpers were removed.
* Unused legacy `composeKnowledgeAwareResponse` helper and commented dead helpers were removed from `handleMessage`.
* Discovery final-response assembly now removes generated extra questions, appends the State Manager question exactly once, and deduplicates repeated diagnosis sentences.
* Unsupported discovery claims such as "prone to errors" are removed unless the user/conversation provides error evidence.
* Added a regression smoke test for the duplicate root-cause diagnosis + premature desired-outcome question bug.
* Discovery flow lock added in `handleMessage` so incomplete onboarding stays on the State Manager path instead of jumping into knowledge/RAG responses from broad router intents.
* Explicit knowledge/service detection tightened so generic discovery answers are not treated as requests for Power BI, CRM, plugins, integrations, or service recommendations.
* Generic "reduce manual work / improve visibility" goals no longer count as a completed desired outcome after root-cause confirmation; the bot must ask the desired-outcome question before moving toward solution direction.
* Gatekeeper stage labels now defer to `conversationStateManager` during onboarding, preventing fallback audit logic from promoting the conversation into solution/recommendation too early.
* Unnecessary onboarding wrapper files were merged into owning modules and deleted:
  * `lib/onboarding/calculateCompletionScore.ts`
  * `lib/onboarding/defaultFields.ts`
  * `lib/onboarding/loadOnboardingFields.ts`
  * `lib/onboarding/loadServiceCategories.ts`
  * `lib/onboarding/updateRequirementMemory.ts`
* Unnecessary agent wrapper/type files were removed after confirming no remaining callers:
  * `lib/agents/memoryAgent.ts`
  * `lib/agents/types.ts`
* Direct memory persistence now uses `lib/data/requirementsRepository.ts`:
  * `getRequirementMemory`
  * `updateRequirementMemory`
* Agents folder optimization completed for safe wrapper deletion.
* Verification passed:
  * `npx tsc --noEmit`
  * `npm run production:check`
  * `npm run build`

## Acceptance Test Status

* Test 1: Opening Discovery - DONE
* Test 2: Process Provided With Teams - DONE
* Test 3: Bottleneck Provided - DONE
* Test 4: Desired Outcome - DONE
* Test 5: No Early Recommendation - DONE
* Test 6: Lead Capture - DONE

## Runtime Compatibility Layers

* Conversation State Manager now owns stage and next-question selection. `responseComposer` still contains rendering guardrails, but no longer owns independent stage selection.
* `discoveryOrchestrator` coordinates memory extraction, readiness scoring, missing-field display, and State Manager result assembly.
* `responseComposer` still has significant formatting, safety, and rendering guardrails.
* `gatekeeperAgent` still exists, but it should now be treated as fallback/audit rather than a normal response brain.
* RAG is controlled by stage now, but still exists as a service for active knowledge and active solution responses.

## Future Cleanup

The required architecture and optimization tasks are implemented. Remaining work is ordinary maintenance, not a blocker for the target behavior.

Full simplified flow is enforced for discovery question selection and composer stage selection. Some legacy orchestration names remain for compatibility:

```txt
User Message
Router
Memory Extractor
Conversation State Manager
Response Generator
Optional Action Handler
```

* `ProjectDiscoveryMemory` now exists as a normalized strict discovery view, but persistence still uses the flexible `RequirementMemory` record.
* Continue moving only genuinely independent helpers when a clear ownership boundary appears.

## Recommended Optimization Backlog

These are recommended follow-up optimizations. They are not required for the completed discovery architecture, but they would reduce repository noise and improve maintainability.

### 1. Root Cleanup - DONE

Removed generated/local files:

* `dev-server.log`
* `.next-dev.log`
* `.next-dev.err.log`
* `.next-dev-qa.log`
* `tsconfig.tsbuildinfo`
* `AwesomeGenie.zip`

`.gitignore` already covers logs, build-info, and zip files.

### 2. Duplicate Script Cleanup - DONE

Deleted after confirming no package/caller references:

* `scripts/seed-chat-config.modified.ts`

The active seed script is now:

* `scripts/maintenance/seed-chat-config.ts`

### 3. Script Folder Cleanup - DONE

Scripts were grouped into:

* production scripts
* QA scripts
* debug scripts

Current layout:

* `scripts/maintenance/`
* `scripts/qa/`
* `scripts/debug/`

Updated package scripts to point to the new paths:

* `scripts/maintenance/production-check.ts`
* `scripts/maintenance/seed-chat-config.ts`
* `scripts/maintenance/drive-check.ts`
* `scripts/qa/full-chatbot-qa.ts`
* `scripts/qa/onboarding-smoke.ts`
* `scripts/qa/e2e-onboarding-smoke.ts`
* `scripts/qa/live-qa-enterprise-onboarding-test.ts`

### 4. Response Composer Split - DONE

`lib/agents/responseComposer.ts` was split along safe ownership boundaries for maintainability.

Implemented split:

* `lib/agents/responseComposer.ts` - main compose orchestration only
* `lib/responses/responseGuards.ts` - deterministic response guards
* `lib/responses/responseFormatting.ts` - markdown/table/text cleanup
* `lib/responses/handoffResponseComposer.ts` - lead handoff / brief-approved responses
* `lib/responses/languageDetection.ts` - shared language detection

The shared knowledge response orchestration remains in `responseComposer.ts` because it uses the same prompt/model pipeline. Knowledge formatting and attribution helpers were moved to the chat knowledge flow module.

### 5. Chat Handler Split - DONE

`lib/chat/handleMessage.ts` is still large and can be split after behavior is stable.

Implemented split:

* `lib/chat/chatKnowledgeFlow.ts`
* `lib/chat/chatDiscoveryFlow.ts`
* `lib/chat/chatPersistence.ts`

Routing and brief branches remain in `handleMessage.ts` because they share the same session response lifecycle. Pure knowledge, discovery, and persistence helpers were extracted.

### 6. Production Debug Logging Cleanup - DONE

Production files still contain debug/telemetry logs. They should be behind an environment-aware logger.

Implemented:

* Added `lib/runtimeLogger.ts`.
* Runtime debug logs are hidden in production unless `RUNTIME_DEBUG=true`.
* Script logs remain unchanged because scripts are command-line tools.

Runtime files to audit first:

* `lib/agents/responseComposer.ts`
* `lib/agents/gatekeeperAgent.ts`
* `lib/langchain/model.ts`
* `lib/ai/modelClient.ts`

Latest optimization verification:

* Static import/reference audit - DONE
* New module existence audit - DONE
* Full TypeScript verification - DONE
* Production environment/integration check - DONE
* Full Next.js production build - DONE
* Onboarding smoke test - DONE

### 7. Discovery Orchestrator Rename - DONE

Renamed the misleading agent name:

* `lib/agents/onboardingAgent.ts` -> `lib/onboarding/discoveryOrchestrator.ts`
* `runOnboardingAgent` -> `runDiscoveryOrchestrator`

This module coordinates extraction/scoring/state evaluation but does not own discovery stages.

### 8. Do Not Merge - KEEP SEPARATE

These are useful boundaries and should remain separate:

* `lib/onboarding/conversationStateManager.ts`
* `lib/agents/routerAgent.ts`
* `lib/data/requirementsRepository.ts`
* RAG ingest/retrieve files
* Google Drive files
* Supabase repository files

---

# Brain Reduction Plan

Previous active decision layers:

1. `routerAgent`
2. `conversationStateManager`
3. `onboardingAgent`
4. `getNextQuestion` - removed
5. `responseComposer`
6. `gatekeeperAgent`
7. RAG answer layer
8. `extractRequirementMemory` if counted separately from onboarding

This is too much for the required workflow. Small decisions are being split across multiple brains, which increases repeated questions, premature recommendations, slow responses, and inconsistent memory use.

Current effective target layers after the latest refactor:

1. `routerAgent`
2. `memoryExtractor` / input understanding
3. `conversationStateManager`
4. `responseGenerator`

Compatibility / service layers still present:

* `discoveryOrchestrator` assembles extraction, scoring, missing fields, and State Manager output without owning stage decisions.
* `gatekeeperAgent` remains fallback/audit-only.
* RAG remains a controlled retrieval service behind `getRagMode`.

## Target Reduced Architecture

Reduce to four main layers:

1. `routerAgent`
   * Only classify the user message intent.
   * Should not decide discovery stage or next question.

2. `memoryExtractor`
   * Only extract facts from the latest user message.
   * Should not decide what to ask next.

3. `conversationStateManager`
   * Main source of truth.
   * Owns current stage, completed fields, next question, RAG mode, recommendation permission, and lead-capture permission.

4. `responseGenerator`
   * Generates the final user-facing response from the state manager output.
   * Does not choose stages independently.

RAG should become a controlled retrieval service, not a response brain.

Gatekeeper should become fallback/audit-only, not part of the normal response path.

## Recommended Refactor Order

1. Convert `getNextQuestion` into a thin wrapper around `conversationStateManager`. DONE, then deleted after caller cleanup.
2. Remove next-question ownership from `onboardingAgent`. DONE; it now reads State Manager output.
3. Move remaining stage rules from `responseComposer` into `conversationStateManager`.
4. Make `gatekeeperAgent` fallback-only after deterministic guards cover the common cases.
5. Keep RAG behind `getRagMode`; do not let it override discovery responses.
6. Add `DRIVE_HANDOFF` as a first-class state after `PROJECT_BRIEF`.

---

# Target Architecture

Use this simplified flow:

```txt
User Message
↓
Router
↓
Conversation State Manager
↓
Response Generator
↓
Optional Action Handler
```

The **Conversation State Manager must be the source of truth**.

No other brain should skip stages, override the state, or recommend solutions early.

---

# Required Flow

The chatbot must follow this exact project discovery flow:

```txt
GREETING
↓
PROBLEM_DISCOVERY
↓
CURRENT_PROCESS
↓
TEAMS_INVOLVED
↓
BOTTLENECK
↓
ROOT_CAUSE_VALIDATION
↓
DESIRED_OUTCOME
↓
SYSTEMS_CONSTRAINTS
↓
SOLUTION_DIRECTION
↓
RECOMMENDATION
↓
QUALIFICATION
↓
LEAD_CAPTURE
↓
PROJECT_BRIEF
↓
DRIVE_HANDOFF
```

---

# Stage Behavior

## 1. GREETING

Bot asks whether the user wants service information or has a project to discuss.

Example:

```txt
Hi, I'm Awesome Genie. I can help you explore AwesomeTech services, answer questions, or shape a project request when you're ready.

Are you looking for information about our services, or do you already have a project you want to discuss?
```

---

## 2. PROBLEM_DISCOVERY

Goal:
Understand the business problem.

Allowed behavior:

* Acknowledge the problem.
* Ask about the current process.

Example:

```txt
It sounds like manual coordination is becoming harder as the workload grows.

Can you walk me through how this process works today?
```

Do not ask about systems, tools, volume, budget, or contact details yet.

---

## 3. CURRENT_PROCESS

Goal:
Understand how the workflow works today.

If the user mentions teams here, save them. Do not ask for teams again.

Example next question if teams are already known:

```txt
Where does this process usually slow down or get stuck?
```

Example next question if teams are not known:

```txt
Which teams or roles are involved in this workflow?
```

---

## 4. TEAMS_INVOLVED

Goal:
Identify departments, roles, and stakeholders.

If the user already mentioned teams in the current process answer, mark this stage complete.

Do not ask the same team question again.

Next question:

```txt
Where does this process usually slow down or get stuck?
```

---

## 5. BOTTLENECK

Goal:
Identify delay points, friction, manual effort, duplicate work, waiting, unclear ownership, or outdated information.

After bottleneck is known, do not ask another bottleneck question.

Move to root cause validation.

Example:

```txt
It sounds like information exists, but teams spend time waiting for updates or verifying whether the latest information is current before they can take action.

Does that assessment sound accurate?
```

---

## 6. ROOT_CAUSE_VALIDATION

Goal:
Validate the diagnosis with the client.

If the user says yes / correct / accurate / exactly / that is right, mark root cause as validated.

If the user corrects the diagnosis, update the root cause and validate again.

Do not recommend solutions yet.

Next question after validation:

```txt
If this process worked exactly the way you'd like it to, what would be different?
```

---

## 7. DESIRED_OUTCOME

Goal:
Understand what success looks like.

Capture:

* faster response time
* less manual follow-up
* single source of truth
* better visibility
* fewer delays
* reduced duplicate work
* better reporting

Do not recommend solutions yet.

Next question:

```txt
Are there any existing systems, tools, or constraints that need to be considered?
```

---

## 8. SYSTEMS_CONSTRAINTS

Goal:
Understand tools, platforms, must-keep systems, security, compliance, timeline, or operational constraints.

Only after this stage may the bot discuss possible solution directions.

Next response should move to solution direction.

---

## 9. SOLUTION_DIRECTION

Goal:
Discuss possible high-level approaches.

Allowed examples:

* centralized status visibility
* workflow automation
* system integration
* reporting visibility
* customer notification workflow

Do not mention specific plugins unless the user asks or retrieved context clearly supports it.

Example:

```txt
Based on what you've shared, there are a few possible directions: creating a centralized status view, reducing manual follow-ups between teams, and improving visibility into pending work.
```

---

## 10. RECOMMENDATION

Goal:
Provide the best-fit direction based only on gathered facts.

Example:

```txt
The strongest direction appears to be a centralized status visibility workflow that gives support and management access to the latest information without relying on repeated manual follow-ups.
```

Then move to qualification.

---

## 11. QUALIFICATION

Goal:
Collect project readiness details.

Ask one at a time:

* timeline
* priority
* number of users or teams
* budget range if needed

Do not over-question.

---

## 12. LEAD_CAPTURE

Goal:
Collect contact details only after enough project context exists.

Ask:

```txt
I have enough context to prepare a project brief for the AwesomeTech team.

Who should we list as the primary contact for this initiative?
```

Then collect:

* company name
* contact name
* email
* role
* preferred next step

---

## 13. PROJECT_BRIEF

Generate a structured brief:

```txt
Client Details
Business Problem
Current Process
Teams Involved
Primary Bottleneck
Root Cause
Desired Outcome
Existing Systems / Constraints
Recommended Direction
Open Questions
Next Steps
```

---

## 14. DRIVE_HANDOFF

Create or prepare Google Drive handoff.

Folder structure:

```txt
Google Drive
└── Awesome Genie Leads
    └── Company Name - Date
        ├── Project Brief.md
        ├── Discovery Notes.md
        └── Lead Details.md
```

If Google Drive integration is not implemented yet, generate the files/content first and clearly mark Drive handoff as pending integration.

---

# Core Rules

## One Question Rule

Every discovery response must ask only one focused question.

Bad:

```txt
What information is collected and how often does this happen?
```

Good:

```txt
What information is most often updated during this process?
```

---

## No Duplicate Questions

If the user already provided a fact, do not ask for it again.

Examples:

* If user mentions customer support, operations, and management, mark `teams_involved` complete.
* If user mentions spreadsheets and email threads, mark `existing_systems` complete.
* If user mentions delays waiting for operations updates, mark `primary_bottleneck` complete.

---

## No Early Recommendations

Do not recommend:

* automation
* analytics
* SharePoint
* plugins
* dashboards
* integrations
* AI solutions
* AwesomeTech services

until these are complete:

```txt
business_problem
current_process
primary_bottleneck
root_cause_validated
desired_outcome
systems_constraints
```

---

## RAG Strategy

RAG should not be fully disabled during discovery.

Instead, RAG must operate in controlled modes so the assistant can understand AwesomeTech's capabilities internally without turning discovery into a sales pitch.

### RAG OFF Mode

Use when:

```txt
GREETING
IRRELEVANT
SMALL_TALK
```

Behavior:

* Do not run retrieval.
* Do not use website knowledge.
* Keep response simple.

---

### RAG Silent Discovery Mode

Use during:

```txt
PROBLEM_DISCOVERY
CURRENT_PROCESS
TEAMS_INVOLVED
BOTTLENECK
ROOT_CAUSE_VALIDATION
DESIRED_OUTCOME
```

Purpose:

* Build internal awareness of which AwesomeTech services, products, plugins, integrations, and capabilities may relate to the user's problem.
* Help classify the opportunity internally.
* Prepare future solution mapping.
* Improve later recommendations once the discovery is complete.

RAG may:

* Retrieve relevant AwesomeTech knowledge internally.
* Identify matching services internally.
* Identify matching products or plugins internally.
* Identify possible solution categories internally.
* Store internal matching signals for later recommendation.

RAG may NOT:

* Recommend services to the user.
* Recommend products to the user.
* Recommend plugins to the user.
* Recommend integrations to the user.
* Mention SharePoint, plugins, dashboards, automation, analytics, or any specific solution unless the user explicitly asks.
* Show URLs.
* Show sources.
* Mention retrieved pages.
* Mention documentation.
* Expose internal RAG results.

Example:

User says:

```txt
We spend a lot of time manually updating loan status information.
```

Silent RAG may internally identify:

- Relevant AwesomeTech services
- Relevant AwesomeTech products
- Relevant AwesomeTech plugins
- Relevant implementation patterns
- Relevant case studies
- Relevant domain expertise
```

But the user-facing response should still be discovery-focused:

```txt
Can you walk me through how this process works today?
```

---

### RAG Active Knowledge Mode

Use when the user explicitly asks about:

```txt
services
products
plugins
integrations
AwesomeTech capabilities
specific platforms
specific features
how something works
```

Examples:

```txt
What services do you offer?
Do you have a plugin for this?
Tell me about your Encompass solutions.
Can AwesomeTech integrate with HubSpot?
```

Behavior:

* RAG may retrieve and use website knowledge.
* The assistant may answer directly using AwesomeTech knowledge.
* The assistant may explain products, services, plugins, or capabilities.
* URLs should still only be shown if the user asks for links, sources, or documentation.

---

### RAG Active Solution Mode

Use when:

```txt
Current stage is SOLUTION_DIRECTION or later
```

AND these are complete:

```txt
business_problem
current_process
primary_bottleneck
root_cause_validated
desired_outcome
systems_constraints
```

Behavior:

* RAG may retrieve relevant AwesomeTech capabilities.
* RAG may support solution mapping.
* RAG may identify existing AwesomeTech services, products, plugins, or implementation patterns that match the client's needs.
* RAG may support recommendation generation.

The assistant may now discuss solution direction, but should still avoid sounding like a sales pitch.

Example:

```txt
Based on what you've shared, there are a few possible directions: creating a centralized status view, reducing manual follow-ups between teams, and improving visibility into pending work.
```

---

### RAG Priority Rule

During discovery:

```txt
RAG = internal advisor
```

During solution and recommendation:

```txt
RAG = solution mapping engine
```

During direct service/product questions:

```txt
RAG = knowledge answering engine
```

The assistant must not expose RAG results before the conversation reaches the correct stage.

---

## No Source URLs Unless Asked

Never show:

* Sources
* Website Pages
* URLs
* Retrieved Documents
* Knowledge Sources

unless the user explicitly asks for links, sources, or documentation.

---

# Memory Fields

Create or normalize a single project discovery memory object:

```ts
type ProjectDiscoveryMemory = {
  business_problem: string | null;
  current_process: string | null;
  teams_involved: string[] | null;
  primary_bottleneck: string | null;
  root_cause_summary: string | null;
  root_cause_validated: boolean;
  desired_outcome: string | null;
  existing_systems: string[] | null;
  constraints: string | null;
  recommended_direction: string | null;
  timeline: string | null;
  priority: string | null;
  users_or_teams_count: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  preferred_next_step: string | null;
};
```

---

# Stage Completion Rules

## business_problem complete if user describes:

* manual work
* visibility issue
* duplicate work
* coordination issue
* delays
* inefficient workflow
* project goal

## current_process complete if user describes:

* how work starts
* what happens next
* who checks or updates information
* how updates are requested or sent

## teams_involved complete if user mentions:

* departments
* roles
* stakeholders
* support
* operations
* management
* sales
* admin
* finance
* HR
* users

## primary_bottleneck complete if user mentions:

* waiting
* delay
* outdated information
* unclear status
* repeated follow-ups
* manual verification
* duplicate updates
* missing ownership

## existing_systems complete if user mentions:

* spreadsheets
* email
* CRM
* ERP
* LOS
* SharePoint
* internal tools
* portals
* dashboards
* documents
* manual trackers

## desired_outcome complete if user describes:

* faster updates
* real-time visibility
* single source of truth
* fewer follow-ups
* reduced manual work
* better reporting
* faster customer response
* improved decision-making

---

# Response Generator Rules

Use this format:

```txt
Brief observation.

One focused question.
```

Avoid:

* "To better understand..."
* "This will help us..."
* "To help us identify..."
* "Our team is interested..."
* repeated "It sounds like..." in every message if possible

Keep responses concise and natural.

---

# Implementation Tasks

## Task 1: Create Conversation State Manager - DONE

Create a deterministic state manager that:

* reads memory
* updates memory from latest message
* determines current stage
* determines next stage
* prevents stage regression

Suggested file:

```txt
lib/onboarding/conversationStateManager.ts
```

---

## Task 2: Merge or Reduce Brains - DONE

Reduce dependency between:

* getNextQuestion
* responseComposer
* gatekeeper

The response should be generated from:

* current stage
* memory
* latest message

Not from multiple independent agents.

---

## Task 3: Make State Manager the Source of Truth - DONE

No agent may:

* ask a question for a completed stage
* recommend solutions before solution stage
* trigger RAG during early discovery
* ask for contact info before lead capture stage

---

## Task 4: Add Duplicate Question Guard - DONE

Before returning a response:

* compare the question against completed memory fields
* if question asks about completed field, replace it with the next valid stage question

Example:
If `teams_involved` is complete and response asks:

```txt
Which teams or roles are involved?
```

Rewrite to:

```txt
Where does this process usually slow down or get stuck?
```

---

## Task 5: Add Early Recommendation Guard - DONE

If current stage is before `SOLUTION_DIRECTION`, block responses containing:

* automation can help
* analytics can help
* dashboard
* plugin
* SharePoint
* integration
* solution
* we can implement
* AwesomeTech can help

Replace with the correct next discovery question.

---

## Task 6: Fix Duplicate Output Bug - DONE

Current bug example:

```txt
To better understand the current workflow, can you walk me through how this process works today?

Can you walk me through how this process works today?
```

Ensure the final response is assembled only once.

Likely cause:

* responseComposer generates a question
* legacy next-question logic appends the same question again

Fix by ensuring only one layer owns the final question.

---

## Task 7: Drive Handoff Action - DONE

When stage reaches `DRIVE_HANDOFF`:

* generate Project Brief.md
* generate Discovery Notes.md
* generate Lead Details.md
* save to Google Drive if integration exists
* otherwise return generated content and mark Drive integration as pending

---

# Acceptance Tests

## Test 1: Opening Discovery

User:

```txt
We already have a project we'd like to discuss. We are trying to reduce manual work and improve visibility across our operations.
```

Expected:

```txt
It sounds like manual coordination is becoming harder as the workload grows.

Can you walk me through how this process works today?
```

---

## Test 2: Process Provided With Teams

User:

```txt
Customer support checks spreadsheets and email threads. If the status is unclear, they contact operations. Management also needs periodic updates.
```

Expected:
Do not ask teams again.

Correct:

```txt
It sounds like information moves through several handoffs before reaching the customer.

Where does this process usually slow down or get stuck?
```

Incorrect:

```txt
Which teams or roles are involved?
```

---

## Test 3: Bottleneck Provided

User:

```txt
The biggest delay happens when support waits for operations to update the spreadsheet or respond by email.
```

Expected:

```txt
It sounds like the information exists, but teams spend time waiting for updates or verifying whether the latest information is current before they can take action.

Does that assessment sound accurate?
```

---

## Test 4: Desired Outcome

User:

```txt
Yes, that is accurate.
```

Expected:

```txt
If this process worked exactly the way you'd like it to, what would be different?
```

---

## Test 5: No Early Recommendation

Before root cause, desired outcome, and constraints are complete, bot must not say:

```txt
Automated alerts can help...
Advanced analytics can help...
SharePoint can help...
This plugin can help...
```

---

## Test 6: Lead Capture

Only after recommendation:

Expected:

```txt
I have enough context to prepare a project brief for the AwesomeTech team.

Who should we list as the primary contact for this initiative?
```

---

# Final Goal

The bot should feel like:

```txt
Senior Consultant
+
Business Analyst
+
Lead Qualification Assistant
+
Developer Handoff Assistant
```

Not:

```txt
FAQ bot
+
Questionnaire bot
+
Sales bot
+
Random RAG answer bot
```

## 2026-07-17 Project Brief Routing Hotfix

Implemented a deterministic project-brief command path to eliminate the remaining discovery-loop regression.

Changes:

* Added `shouldGenerateProjectBriefNow()` as the single code-owned decision for immediate brief generation.
* Explicit brief requests no longer depend on `hasBasicContext(memory)`; partial context produces a brief with unknown information marked as open items instead of asking another discovery question.
* Removed the duplicate later project-brief generation branch from `handleMessage.ts`.
* Brief-generation responses now directly deliver the brief instead of saying the assistant "can" prepare it.
* Added English and Roman Urdu command recognition, including `brief bana do` and `brief tayyar kar do`.
* Kept brief revision, approval, and handoff requests out of the generation branch.
* Added `scripts/qa/project-brief-routing-smoke.ts` and `npm run test:brief-routing`.

Verification:

* `npm run test:brief-routing` - passed.
* `npx tsc --noEmit` - passed.
* `npm run build` reached Next.js compilation but could not complete because the isolated verification environment could not fetch Google Fonts (`fonts.googleapis.com`). This was an external network failure, not a TypeScript or routing failure.

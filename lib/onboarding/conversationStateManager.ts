import type { RequirementMemory } from "@/lib/data/requirementsRepository";

export type DiscoveryStage =
  | "problem_discovery"
  | "current_process"
  | "teams_involved"
  | "bottleneck"
  | "root_cause_validation"
  | "desired_outcome"
  | "systems_constraints"
  | "solution_direction"
  | "recommendation"
  | "qualification"
  | "lead_capture"
  | "project_brief"
  | "drive_handoff";

export type ProjectDiscoveryMemory = {
  business_problem: string | null;
  current_process: string | null;
  teams_involved: string[] | null;
  primary_bottleneck: string | null;
  root_cause_summary: string | null;
  root_cause_validated: boolean;
  desired_outcome: string | null;
  existing_systems: string[] | null;
  constraints: string | null;
  solution_direction: string | null;
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

export type ConversationState = {
  stage: DiscoveryStage;
  completed: Record<string, boolean>;
  nextQuestion: string | null;
  canRecommend: boolean;
  canCaptureLead: boolean;
  ragMode?: RagMode;
};

export type RagMode = "off" | "silent_discovery" | "active_knowledge" | "active_solution";

type ConversationStateInput = {
  memory: RequirementMemory;
  recentConversation?: string;
  lastUserMessage?: string;
};

type RagModeInput = {
  state: ConversationState;
  explicitKnowledgeAsk?: boolean;
  intent?: string;
};

export function evaluateConversationState({
  memory,
  recentConversation = "",
  lastUserMessage = ""
}: ConversationStateInput): ConversationState {
  const discoveryMemory = normalizeProjectDiscoveryMemory(memory);
  const text = [
    recentConversation,
    lastUserMessage,
    memory.latest_project_note,
    memory.project_overview,
    discoveryMemory.business_problem,
    memory.pain_points,
    discoveryMemory.current_process,
    discoveryMemory.teams_involved?.join(", "),
    discoveryMemory.primary_bottleneck,
    discoveryMemory.root_cause_summary,
    discoveryMemory.desired_outcome,
    discoveryMemory.existing_systems?.join(", "),
    discoveryMemory.constraints,
    discoveryMemory.solution_direction,
    discoveryMemory.recommended_direction,
    discoveryMemory.timeline,
    discoveryMemory.priority,
    memory.budget_range
  ]
    .filter(hasValue)
    .map(String)
    .join("\n");

  const completed = {
    problem: hasProblem(memory, text),
    current_process:
      hasAnsweredCurrentProcessQuestion(recentConversation) ||
      hasStepwiseCurrentProcess(lastUserMessage) ||
      hasReliableCurrentProcessMemory(discoveryMemory.current_process),
    teams_involved: Boolean(discoveryMemory.teams_involved?.length) || hasTeamSignals(text),
    primary_bottleneck: hasValue(discoveryMemory.primary_bottleneck) || hasBottleneckSignals(text),
    root_cause_validated:
      hasRootCauseValidated(discoveryMemory, lastUserMessage) ||
      hasAnsweredRootCauseQuestion(recentConversation),
    desired_outcome:
      hasAnsweredDesiredOutcomeQuestion(recentConversation) ||
      hasUnpromptedDesiredOutcome(lastUserMessage) ||
      hasRecentUnpromptedDesiredOutcome(recentConversation) ||
      hasProgressedBeyondDesiredOutcome(memory),
    systems_constraints: hasSystemsConstraints(memory, recentConversation, text),
    solution_direction: hasSolutionDirection(memory, text),
    recommendation: hasRecommendation(memory, text),
    qualification: hasQualification(memory, text),
    company_name: hasValue(discoveryMemory.company_name),
    contact_name: hasValue(discoveryMemory.contact_name),
    email: hasValue(discoveryMemory.contact_email),
    contact_role: hasValue(discoveryMemory.contact_role),
    preferred_next_step: hasValue(discoveryMemory.preferred_next_step),
    project_brief: hasProjectBrief(text),
    drive_handoff: hasDriveHandoff(text)
  };

  const canRecommend = hasSolutionReadiness(completed);
  const canCaptureLead = canRecommend && completed.solution_direction && completed.recommendation;
  const lifecycleStage = typeof memory.current_stage === "string" ? memory.current_stage : "";

  if (["brief_generated", "brief_revision"].includes(lifecycleStage)) {
    return {
      stage: "project_brief",
      completed: { ...completed, project_brief: true },
      canRecommend: true,
      canCaptureLead: true,
      nextQuestion: null
    };
  }

  if (["brief_approved", "scoping_ready", "handoff_complete"].includes(lifecycleStage)) {
    return {
      stage: "drive_handoff",
      completed: { ...completed, project_brief: true, drive_handoff: true },
      canRecommend: true,
      canCaptureLead: true,
      nextQuestion: null
    };
  }

  if (!completed.problem) {
    return {
      stage: "problem_discovery",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "What is the main operational challenge you want to solve first?"
    };
  }

  if (!completed.current_process) {
    return {
      stage: "current_process",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Can you walk me through how this process works today?"
    };
  }

  if (!completed.teams_involved) {
    return {
      stage: "teams_involved",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Which teams or roles are involved in this process?"
    };
  }

  if (!completed.primary_bottleneck) {
    return {
      stage: "bottleneck",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Where does this process usually slow down or get stuck?"
    };
  }

  if (!completed.desired_outcome) {
    return {
      stage: "desired_outcome",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Which area should we treat as the first priority?"
    };
  }

  if (!completed.systems_constraints) {
    const existingSystemsKnown =
      Boolean(discoveryMemory.existing_systems?.length) || hasSystemSignals(text);

    return {
      stage: "systems_constraints",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: existingSystemsKnown
        ? "Are there any security, compliance, timeline, or operational constraints we should consider?"
        : "What systems, platforms, or tools are currently involved in this workflow?"
    };
  }

  if (!completed.qualification) {
    return {
      stage: "qualification",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "What timeline or priority should our team keep in mind for this initiative?"
    };
  }

  if (!completed.contact_name) {
    return {
      stage: "lead_capture",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Who should we list as the primary contact for this initiative?"
    };
  }

  if (!completed.email) {
    return {
      stage: "lead_capture",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "What email address should our team use for follow-up?"
    };
  }

  if (!completed.company_name) {
    return {
      stage: "lead_capture",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "What company name should we include in the project brief?"
    };
  }

  if (!completed.project_brief) {
    return {
      stage: "project_brief",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Would you like me to generate your official project brief for our sales and implementation teams now?"
    };
  }

  if (!completed.drive_handoff) {
    return {
      stage: "drive_handoff",
      completed,
      canRecommend,
      canCaptureLead,
      nextQuestion: "Would you like me to prepare the Drive handoff package for our team?"
    };
  }

  return {
    stage: "project_brief",
    completed,
    canRecommend,
    canCaptureLead,
    nextQuestion: null
  };
}

export function normalizeProjectDiscoveryMemory(memory: RequirementMemory): ProjectDiscoveryMemory {
  return {
    business_problem: firstText(memory.business_problem, memory.project_overview, memory.pain_points, memory.goals),
    current_process: firstText(memory.current_process),
    teams_involved: toStringList(memory.teams_involved),
    primary_bottleneck: firstText(memory.primary_bottleneck, memory.pain_points),
    root_cause_summary: firstText(memory.root_cause_summary),
    root_cause_validated: memory.root_cause_validated === true,
    desired_outcome: firstText(memory.desired_outcome),
    existing_systems: toStringList(memory.existing_systems),
    constraints: firstText(memory.constraints),
    solution_direction: firstText(memory.solution_direction),
    recommended_direction: firstText(memory.recommended_direction),
    timeline: firstText(memory.timeline),
    priority: firstText(memory.priority),
    users_or_teams_count: firstText(memory.users_or_teams_count, memory.team_size),
    company_name: firstText(memory.company_name),
    contact_name: firstText(memory.contact_name),
    contact_email: firstText(memory.contact_email, memory.email),
    contact_role: firstText(memory.contact_role),
    preferred_next_step: firstText(memory.preferred_next_step)
  };
}

export function getRagMode({
  state,
  explicitKnowledgeAsk = false,
  intent = ""
}: RagModeInput): RagMode {
  if (explicitKnowledgeAsk) {
    return "active_knowledge";
  }

  if (["greeting", "irrelevant", "small_talk"].includes(intent)) {
    return "off";
  }

  if (state.stage === "solution_direction" || state.stage === "recommendation") {
    return hasSolutionReadiness(state.completed) ? "active_solution" : "silent_discovery";
  }

  if (["qualification", "lead_capture", "project_brief", "drive_handoff"].includes(state.stage)) {
    return "active_solution";
  }

  return "silent_discovery";
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "null" && trimmed !== "undefined";
  }

  return value !== undefined && value !== null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (!hasValue(value)) {
      continue;
    }

    const text = String(value).trim();
    if (text.length > 0) {
      return text;
    }
  }

  return null;
}

function toStringList(value: unknown): string[] | null {
  if (!hasValue(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  }

  const items = String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function hasProblem(memory: RequirementMemory, text: string) {
  return (
    hasValue(memory.project_overview) ||
    hasValue(memory.business_problem) ||
    hasValue(memory.pain_points) ||
    hasValue(memory.goals) ||
    /\b(manual work|manual coordination|visibility|delay|delays|harder to manage|inefficient|bottleneck|challenge|problem)\b/i.test(text)
  );
}

function hasReliableCurrentProcessMemory(value: unknown) {
  if (!hasValue(value)) return false;
  return hasStepwiseCurrentProcess(String(value));
}

function hasStepwiseCurrentProcess(text: string) {
  const normalized = text.toLowerCase();
  const hasSequenceSignal =
    /\b(starts when|typical process|first|firstly|then|after that|next|finally|from there|once .* then|step)\b/i.test(
      normalized
    );
  const hasWorkflowAction =
    /\b(updated?|checks?|contacts?|sends?|reviews?|gathers?|responds?|handoffs?|syncs?|enters?|copies?|moves?|routes?)\b/i.test(
      normalized
    );
  const hasSystemOrTeam =
    /\b(encompass|hubspot|spreadsheet|spreadsheets|email|crm|system|tool|operations|support|sales|processing|underwriting|closing|borrower|vendor)\b/i.test(
      normalized
    );

  return hasSequenceSignal && hasWorkflowAction && hasSystemOrTeam;
}

function hasAnsweredCurrentProcessQuestion(recentConversation: string) {
  return hasSubstantiveAnswerAfterAssistantQuestion(
    recentConversation,
    /\b(walk me through how this process works today|walk me through one of the manual processes|how this process works today)\b/i,
    hasStepwiseCurrentProcess
  );
}

function hasTeamSignals(text: string) {
  const normalized = text.toLowerCase();
  const teamTerms = [
    "customer support",
    "support team",
    "operations",
    "operations team",
    "management",
    "sales",
    "finance",
    "accounting",
    "admin",
    "hr",
    "it team",
    "engineering",
    "delivery team",
    "implementation team",
    "processing",
    "underwriting",
    "closing",
    "marketing",
    "leadership"
  ];

  return teamTerms.filter((term) => normalized.includes(term)).length >= 2;
}

function hasBottleneckSignals(text: string) {
  return /\b(delay|delays|delayed|slow|slows|slowdown|stuck|wait|waits|waiting|missing|outdated|not updated|not yet updated|bottleneck|friction)\b/i.test(
    text
  );
}

function hasRootCauseValidated(memory: ProjectDiscoveryMemory, text: string) {
  return (
    memory.root_cause_validated ||
    hasRootCauseConfirmationText(text)
  );
}

function hasRootCauseConfirmationText(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/[^\w'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /\b(assessment sounds accurate|that assessment is accurate|yes that is accurate|yes that's accurate|yes accurate|that's accurate|that sounds right|sounds accurate|correct assessment)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  return (
    /\b(assessment sounds accurate|that assessment is accurate|yes that is accurate|yes,?\s+that['’]?s accurate|yes,?\s+accurate|that['’]?s accurate|that sounds right|sounds accurate|correct assessment)\b/i.test(
      text
    )
  );
}

function hasDesiredOutcomeSignals(text: string) {
  return /\b(single source of truth|faster updates|better visibility|less manual work|reduce manual|clear answer|real-time visibility|improve visibility|internal visibility|ideal process|success would|keeping .* in sync|keep .* in sync|hubspot in sync|automating borrower updates|automate borrower updates|borrower updates|biggest priority|main priority)\b/i.test(
    text
  );
}

function hasUnpromptedDesiredOutcome(lastUserMessage: string) {
  const normalized = lastUserMessage.trim();
  if (!normalized || isShortConfirmation(normalized)) return false;

  return normalized.split(/\s+/).length >= 4 && hasDesiredOutcomeSignals(normalized);
}

function hasAnsweredDesiredOutcomeQuestion(recentConversation: string) {
  return hasSubstantiveAnswerAfterAssistantQuestion(
    recentConversation,
    /\b(what would be different|what does success look like|what would success look like|ideal outcome|desired outcome)\b/i,
    hasDesiredOutcomeSignals
  );
}

function hasAnsweredRootCauseQuestion(recentConversation: string) {
  return hasAnswerAfterAssistantQuestion(
    recentConversation,
    /\bdoes (?:that|this) assessment sound accurate\?/i,
    hasRootCauseConfirmationText
  );
}

function hasRecentUnpromptedDesiredOutcome(recentConversation: string) {
  const userTurns = recentConversation
    .split(/\n(?=(?:assistant|user):)/i)
    .map((turn) => turn.trim())
    .filter((turn) => /^user:/i.test(turn))
    .map((turn) => turn.replace(/^user:\s*/i, "").trim());

  return userTurns.some((turn) => hasUnpromptedDesiredOutcome(turn));
}

function hasProgressedBeyondDesiredOutcome(memory: RequirementMemory) {
  return (
    hasValue(memory.desired_outcome) &&
    (hasValue(memory.solution_direction) ||
      hasValue(memory.recommended_direction) ||
      hasValue(memory.timeline) ||
      hasValue(memory.priority))
  );
}

function isShortConfirmation(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized.split(" ").length <= 8 &&
    /^(yes|yeah|correct|exactly|right|yes that's accurate|that's accurate|that is accurate|that sounds right)/i.test(
      normalized
    )
  );
}

function hasSystemSignals(text: string) {
  return /\b(spreadsheet|spreadsheets|email|email threads|crm|erp|los|sharepoint|internal tools|platform|system|tools)\b/i.test(
    text
  );
}

function hasSystemsConstraints(memory: RequirementMemory, recentConversation: string, text: string) {
  const systemsKnown = hasValue(memory.existing_systems) || hasSystemSignals(text);
  const constraintsKnown =
    hasValue(memory.constraints) ||
    hasSubstantiveAnswerAfterAssistantQuestion(
      recentConversation,
      /\b(security|compliance|timeline|operational constraints|constraints we should consider)\b/i,
      (answer) => answer.trim().length > 0
    );

  return systemsKnown && constraintsKnown;
}

function hasSubstantiveAnswerAfterAssistantQuestion(
  recentConversation: string,
  questionPattern: RegExp,
  answerValidator: (answer: string) => boolean
) {
  return hasAnswerAfterAssistantQuestion(
    recentConversation,
    questionPattern,
    (answer) => !isShortConfirmation(answer) && answerValidator(answer)
  );
}

function hasAnswerAfterAssistantQuestion(
  recentConversation: string,
  questionPattern: RegExp,
  answerValidator: (answer: string) => boolean
) {
  const turns = recentConversation
    .split(/\n(?=(?:assistant|user):)/i)
    .map((turn) => turn.trim())
    .filter(Boolean);
  let questionIndex = -1;

  turns.forEach((turn, index) => {
    if (/^assistant:/i.test(turn) && questionPattern.test(turn)) {
      questionIndex = index;
    }
  });

  if (questionIndex < 0) return false;

  const answer = turns
    .slice(questionIndex + 1)
    .find((turn) => /^user:/i.test(turn))
    ?.replace(/^user:\s*/i, "")
    .trim();

  return Boolean(answer && answerValidator(answer));
}

function hasSolutionDirection(memory: RequirementMemory, text: string) {
  return (
    hasValue(memory.solution_direction) ||
    /\b(practical direction|solution direction|possible direction|centralized status visibility|reduce manual follow-ups|improve status visibility)\b/i.test(
      text
    )
  );
}

function hasRecommendation(memory: RequirementMemory, text: string) {
  return (
    hasValue(memory.recommended_direction) ||
    /\b(recommended direction|recommended approach|recommendation sound aligned|strongest direction appears|strongest direction is)\b/i.test(
      text
    )
  );
}

function hasQualification(memory: RequirementMemory, text: string) {
  return (
    hasValue(memory.timeline) ||
    hasValue(memory.priority) ||
    hasValue(memory.users_or_teams_count) ||
    hasValue(memory.budget_range) ||
    /\b(timeline|priority|urgent|as soon as possible|asap|this quarter|next quarter|budget|users|teams count|number of users)\b/i.test(
      text
    )
  );
}

function hasProjectBrief(text: string) {
  return /\b(project brief|official brief|brief generated|generated brief|sales and implementation teams)\b/i.test(text);
}

function hasDriveHandoff(text: string) {
  return /\b(drive handoff|google drive|drive folder|handoff package|lead handoff package|project brief\.md|discovery notes\.md|lead details\.md)\b/i.test(
    text
  );
}

function hasSolutionReadiness(completed: Record<string, boolean>) {
  return Boolean(
    completed.problem &&
      completed.current_process &&
      completed.primary_bottleneck &&
      completed.root_cause_validated &&
      completed.desired_outcome &&
      completed.systems_constraints
  );
}

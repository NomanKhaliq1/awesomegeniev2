import type { RouteDecision } from "@/lib/agents/routerAgent";
import type { ConversationState, DiscoveryStage, RagMode } from "@/lib/onboarding/conversationStateManager";

export type FlowStepStatus = "done" | "current" | "pending";

export type FlowStep = {
  stage: DiscoveryStage;
  label: string;
  status: FlowStepStatus;
};

export type FlowDetector = {
  currentStage: DiscoveryStage;
  currentStageLabel: string;
  expectedNextQuestion: string | null;
  routeIntent?: string;
  ragMode?: RagMode;
  canRecommend: boolean;
  canCaptureLead: boolean;
  warning: string | null;
  steps: FlowStep[];
};

const flowOrder: Array<{ stage: DiscoveryStage; completedKey?: string; label: string }> = [
  { stage: "problem_discovery", completedKey: "problem", label: "Problem" },
  { stage: "current_process", completedKey: "current_process", label: "Current process" },
  { stage: "teams_involved", completedKey: "teams_involved", label: "Teams" },
  { stage: "bottleneck", completedKey: "primary_bottleneck", label: "Bottleneck" },
  { stage: "root_cause_validation", completedKey: "root_cause_validated", label: "Root validation" },
  { stage: "desired_outcome", completedKey: "desired_outcome", label: "Desired outcome" },
  { stage: "systems_constraints", completedKey: "systems_constraints", label: "Systems & constraints" },
  { stage: "solution_direction", completedKey: "solution_direction", label: "Solution direction" },
  { stage: "recommendation", completedKey: "recommendation", label: "Recommendation" },
  { stage: "qualification", completedKey: "qualification", label: "Qualification" },
  { stage: "lead_capture", label: "Lead capture" },
  { stage: "project_brief", completedKey: "project_brief", label: "Project brief" },
  { stage: "drive_handoff", completedKey: "drive_handoff", label: "Drive handoff" }
];

export function buildFlowDetector({
  state,
  routeDecision,
  ragMode
}: {
  state: ConversationState;
  routeDecision?: Pick<RouteDecision, "intent"> | null;
  ragMode?: RagMode;
}): FlowDetector {
  const currentIndex = Math.max(
    0,
    flowOrder.findIndex((step) => step.stage === state.stage)
  );

  const steps = flowOrder.map((step, index) => {
    const isDone = step.completedKey ? Boolean(state.completed[step.completedKey]) : index < currentIndex;
    const status: FlowStepStatus =
      step.stage === state.stage ? "current" : isDone || index < currentIndex ? "done" : "pending";

    return {
      stage: step.stage,
      label: step.label,
      status
    };
  });

  const warning = getFlowWarning(state, routeDecision?.intent, ragMode);

  return {
    currentStage: state.stage,
    currentStageLabel: getStageLabel(state.stage),
    expectedNextQuestion: state.nextQuestion,
    routeIntent: routeDecision?.intent,
    ragMode,
    canRecommend: state.canRecommend,
    canCaptureLead: state.canCaptureLead,
    warning,
    steps
  };
}

export function buildInitialFlowDetector(): FlowDetector {
  return {
    currentStage: "problem_discovery",
    currentStageLabel: getStageLabel("problem_discovery"),
    expectedNextQuestion: "Are you looking for information about our services, or do you already have a project you want to discuss?",
    routeIntent: "greeting",
    ragMode: "off",
    canRecommend: false,
    canCaptureLead: false,
    warning: null,
    steps: flowOrder.map((step, index) => ({
      stage: step.stage,
      label: step.label,
      status: index === 0 ? "current" : "pending"
    }))
  };
}

export function buildCompletedFlowDetector(): FlowDetector {
  return {
    currentStage: "drive_handoff",
    currentStageLabel: "Complete",
    expectedNextQuestion: null,
    routeIntent: "handoff_complete",
    ragMode: "off",
    canRecommend: true,
    canCaptureLead: true,
    warning: null,
    steps: flowOrder.map((step) => ({
      stage: step.stage,
      label: step.label,
      status: "done"
    }))
  };
}

function getStageLabel(stage: DiscoveryStage) {
  return flowOrder.find((step) => step.stage === stage)?.label ?? stage;
}

function getFlowWarning(
  state: ConversationState,
  routeIntent?: string,
  ragMode?: RagMode
) {
  const discoveryIncomplete =
    !state.canRecommend &&
    !["qualification", "lead_capture", "project_brief", "drive_handoff"].includes(state.stage);

  if (
    discoveryIncomplete &&
    ["service_inquiry", "knowledge_question", "technical_discussion", "pricing_discussion", "knowledge"].includes(
      routeIntent ?? ""
    ) &&
    ragMode !== "silent_discovery"
  ) {
    return "Router/RAG may be ahead of discovery. Keep assistant on the current discovery question.";
  }

  if (!state.canRecommend && ["solution_direction", "recommendation"].includes(state.stage)) {
    return "Recommendation stage reached before all required discovery checks are complete.";
  }

  return null;
}

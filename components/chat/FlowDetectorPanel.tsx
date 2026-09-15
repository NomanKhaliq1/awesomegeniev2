import styles from "./FlowDetectorPanel.module.css";

export type FlowDetectorState = {
  currentStageLabel: string;
  expectedNextQuestion: string | null;
  routeIntent?: string;
  ragMode?: string;
  canRecommend: boolean;
  canCaptureLead: boolean;
  warning: string | null;
  steps: Array<{
    stage: string;
    label: string;
    status: "done" | "current" | "pending";
  }>;
};

type FlowDetectorPanelProps = {
  flowDetector: FlowDetectorState | null;
};

export function FlowDetectorPanel({ flowDetector }: FlowDetectorPanelProps) {
  if (!flowDetector) {
    return null;
  }

  const getStepClass = (status: FlowDetectorState["steps"][number]["status"]) => {
    if (status === "done") return styles.done;
    if (status === "current") return styles.current;
    return styles.pending;
  };

  return (
    <section className={styles.panel} aria-label="Flow detector">
      <div className={styles.header}>
        <h2>Flow Detector</h2>
        <span>{flowDetector.currentStageLabel}</span>
      </div>

      <div className={styles.meta}>
        <span>Route: {flowDetector.routeIntent ?? "Not recorded yet"}</span>
        <span>RAG: {flowDetector.ragMode ?? "Not used yet"}</span>
        <span>{flowDetector.canRecommend ? "Recommend allowed" : "Discovery mode"}</span>
      </div>

      {flowDetector.warning ? (
        <p className={styles.warning}>{flowDetector.warning}</p>
      ) : null}

      {flowDetector.expectedNextQuestion ? (
        <p className={styles.nextQuestion}>
          <strong>Expected next:</strong> {flowDetector.expectedNextQuestion}
        </p>
      ) : null}

      <ol className={styles.steps}>
        {flowDetector.steps.map((step) => (
          <li key={step.stage} className={getStepClass(step.status)}>
            <span aria-hidden="true" />
            <em>{step.label}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

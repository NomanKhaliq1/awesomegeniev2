import styles from "./ProgressPanel.module.css";

type ProgressPanelProps = {
  completionScore: number;
  collectedItems: string[];
  missingFields: string[];
  labels: {
    progressTitle: string;
    collectedTitle: string;
    missingTitle: string;
    collectedEmptyText: string;
    missingEmptyText: string;
  };
};

export function ProgressPanel({
  completionScore,
  collectedItems,
  missingFields,
  labels
}: ProgressPanelProps) {
  const normalizedScore = Math.max(0, Math.min(100, completionScore));

  return (
    <div className={styles.panel}>
      <div>
        <div className={styles.headerRow}>
          <h2>{labels.progressTitle}</h2>
          <strong>{normalizedScore}%</strong>
        </div>
        <div className={styles.track}>
          <span style={{ width: `${normalizedScore}%` }} />
        </div>
      </div>

      <section>
        <h3>{labels.collectedTitle}</h3>
        {collectedItems.length > 0 ? (
          <ul>
            {collectedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyText}>{labels.collectedEmptyText}</p>
        )}
      </section>

      <section>
        <h3>{labels.missingTitle}</h3>
        {missingFields.length > 0 ? (
          <ul>
            {missingFields.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyText}>{labels.missingEmptyText}</p>
        )}
      </section>
    </div>
  );
}

import styles from "./ChatMessage.module.css";

type ChatMessageProps = {
  role: "assistant" | "user";
  content: string;
  assistantLabel: string;
  userLabel: string;
};

export function ChatMessage({ role, content, assistantLabel, userLabel }: ChatMessageProps) {
  return (
    <article className={`${styles.message} ${styles[role]}`}>
      <div className={styles.label}>{role === "assistant" ? assistantLabel : userLabel}</div>
      <p>{content}</p>
    </article>
  );
}

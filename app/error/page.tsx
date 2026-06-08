import { AlertCircle } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import styles from "./error.module.css";

export default function ErrorPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Logo size="large" />
        <AlertCircle className={styles.icon} aria-hidden="true" />
        <h1>Something went wrong.</h1>
        <p>
          Your chat details are important. Please return to the chatbot and try
          again.
        </p>
        <a className={styles.link} href="/chat">
          Back to chat
        </a>
      </section>
    </main>
  );
}

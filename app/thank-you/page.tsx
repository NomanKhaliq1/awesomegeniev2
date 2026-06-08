import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import styles from "./thank-you.module.css";

export default function ThankYouPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Logo size="large" />
        <CheckCircle2 className={styles.icon} aria-hidden="true" />
        <h1>Thanks. Your project details have been submitted.</h1>
        <p>
          The AwesomeTech team has received your onboarding details and will
          review the next steps.
        </p>
      </section>
    </main>
  );
}

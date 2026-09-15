"use client";

import { Check, RefreshCw, Star } from "lucide-react";
import { useState } from "react";
import styles from "./ChatCompletionPanel.module.css";

export type FeedbackPayload = {
  rating: number;
  tags: string[];
  comment: string;
};

const feedbackOptions = [
  { value: "helpful", label: "Helpful" },
  { value: "understood_requirements", label: "Understood requirements" },
  { value: "repeated_questions", label: "Repeated questions" },
  { value: "made_assumptions", label: "Made assumptions" },
  { value: "too_long", label: "Too long" }
];

export function ChatCompletionPanel({
  submitted = false,
  onSubmit,
  onStartNewChat
}: {
  submitted?: boolean;
  onSubmit: (feedback: FeedbackPayload) => Promise<boolean>;
  onStartNewChat: () => void | Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };

  const submitFeedback = async () => {
    if (!rating || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    const saved = await onSubmit({ rating, tags, comment: comment.trim() });
    if (!saved) {
      setSubmitError("Feedback could not be saved. Please try again.");
    }
    setIsSubmitting(false);
  };

  return (
    <section className={styles.panel} aria-label="Onboarding completion">
      <div className={styles.summary}>
        <span className={styles.completeIcon}><Check aria-hidden="true" /></span>
        <div>
          <strong>Onboarding complete</strong>
          <p>Your project brief is ready for team review and follow-up.</p>
        </div>
      </div>

      {submitted ? (
        <div className={styles.thanks} role="status">
          <Check aria-hidden="true" />
          <span>Thanks. Your feedback has been recorded.</span>
        </div>
      ) : (
        <div className={styles.feedback}>
          <div className={styles.ratingBlock}>
            <span>Rate this interaction</span>
            <div className={styles.stars} role="radiogroup" aria-label="Interaction rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? styles.starSelected : styles.starButton}
                  onClick={() => setRating(value)}
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                >
                  <Star aria-hidden="true" fill={value <= rating ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tags} aria-label="Feedback reasons">
            {feedbackOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={tags.includes(option.value) ? styles.tagSelected : styles.tag}
                aria-pressed={tags.includes(option.value)}
                onClick={() => toggleTag(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="Additional feedback (optional)"
            aria-label="Additional feedback"
          />
          {submitError ? <p className={styles.error}>{submitError}</p> : null}
          <button
            type="button"
            className={styles.submitButton}
            disabled={!rating || isSubmitting}
            onClick={() => void submitFeedback()}
          >
            {isSubmitting ? "Submitting..." : "Submit feedback"}
          </button>
        </div>
      )}

      <button type="button" className={styles.newChatButton} onClick={() => void onStartNewChat()}>
        <RefreshCw aria-hidden="true" />
        Start new chat
      </button>
    </section>
  );
}

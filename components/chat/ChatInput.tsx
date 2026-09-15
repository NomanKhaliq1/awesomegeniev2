"use client";

import type { ReactNode } from "react";
import { useState, useRef, useEffect } from "react";
import styles from "./ChatInput.module.css";

type ChatInputProps = {
  placeholder: string;
  inputAriaLabel: string;
  sendAriaLabel: string;
  sendIcon: ReactNode;
  disabled?: boolean;
  onSend: (message: string) => void | Promise<void>;
};

export function ChatInput({
  placeholder,
  inputAriaLabel,
  sendAriaLabel,
  sendIcon,
  disabled = false,
  onSend
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea dynamically based on scrollHeight
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      // Cap maximum height to 160px (about 6-7 lines), scrollbar kicks in after
      textarea.style.height = `${Math.min(scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || disabled) {
      return;
    }
    void onSend(trimmedValue);
    setValue("");
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <textarea
        ref={textareaRef}
        aria-label={inputAriaLabel}
        placeholder={placeholder}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Submit on Enter, allow Shift+Enter for newlines
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button
        type="submit"
        aria-label={sendAriaLabel}
        disabled={disabled || !value.trim()}
      >
        {sendIcon}
      </button>
    </form>
  );
}

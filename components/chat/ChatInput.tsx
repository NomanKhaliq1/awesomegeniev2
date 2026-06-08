"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedValue = value.trim();

        if (!trimmedValue || disabled) {
          return;
        }

        void onSend(trimmedValue);
        setValue("");
      }}
    >
      <textarea
        aria-label={inputAriaLabel}
        placeholder={placeholder}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
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

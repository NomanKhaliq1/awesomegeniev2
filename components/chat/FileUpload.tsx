"use client";

import type { ReactNode } from "react";
import styles from "./FileUpload.module.css";

type FileUploadProps = {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onUpload: (files: FileList) => void | Promise<void>;
};

export function FileUpload({
  icon,
  label,
  ariaLabel,
  disabled = false,
  onUpload
}: FileUploadProps) {
  return (
    <label
      aria-disabled={disabled}
      className={`${styles.upload} ${disabled ? styles.disabled : ""}`}
    >
      <input
        aria-label={ariaLabel}
        type="file"
        multiple
        disabled={disabled}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.svg,.zip,.html,.json,.xml"
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            void onUpload(event.currentTarget.files);
            event.currentTarget.value = "";
          }
        }}
      />
      {icon}
      <span>{label}</span>
    </label>
  );
}

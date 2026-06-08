"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import styles from "./Logo.module.css";

const fallbackLogoPaths = [
  "/logo.png",
  "/logo.svg",
  "/awesome-genie-logo.png",
  "/awesome-genie-logo.svg",
  "/logo.webp"
];

type LogoProps = {
  size?: "small" | "large";
};

export function Logo({ size = "small" }: LogoProps) {
  const configuredPath = process.env.NEXT_PUBLIC_LOGO_PATH;
  const candidates = useMemo(
    () => [
      ...(configuredPath ? [configuredPath] : []),
      ...fallbackLogoPaths.filter((path) => path !== configuredPath)
    ],
    [configuredPath]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const logoPath = candidates[candidateIndex];

  if (showFallback || !logoPath) {
    return <span className={`${styles.textLogo} ${styles[size]}`}>Awesome Genie</span>;
  }

  return (
    <span className={`${styles.logo} ${styles[size]}`}>
      <Image
        src={logoPath}
        alt="Awesome Genie"
        fill
        sizes={size === "large" ? "180px" : "132px"}
        onError={() => {
          if (candidateIndex < candidates.length - 1) {
            setCandidateIndex(candidateIndex + 1);
            return;
          }

          setShowFallback(true);
        }}
        priority
      />
    </span>
  );
}

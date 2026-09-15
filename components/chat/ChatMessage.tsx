"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import styles from "./ChatMessage.module.css";

type ChatMessageProps = {
  role: "assistant" | "user";
  content: string;
  assistantLabel: string;
  userLabel: string;
};

export function ChatMessage({ role, content, assistantLabel, userLabel }: ChatMessageProps) {
  const isAssistant = role === "assistant";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);

          if (containerRef.current) {
            observer.unobserve(containerRef.current);
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -5% 0px"
      }
    );

    const currentRef = containerRef.current;

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.messageContainer} ${
        isAssistant ? styles.assistantContainer : styles.userContainer
      } ${isVisible ? styles.visible : ""}`}
    >
      <div className={styles.avatar}>
        {isAssistant ? <Bot size={16} /> : <User size={16} />}
      </div>

      <article className={styles.bubble}>
        <div className={styles.label}>{isAssistant ? assistantLabel : userLabel}</div>

        <div className={styles.messageContent}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <p className={styles.paragraph}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul className={styles.list}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className={styles.list}>{children}</ol>
              ),
              table: ({ children }) => (
                <div className={styles.tableWrapper}>
                  <table className={styles.markdownTable}>{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className={styles.tableHead}>{children}</th>
              ),
              td: ({ children }) => (
                <td className={styles.tableCell}>{children}</td>
              ),
              a: ({ children, href }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              )
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
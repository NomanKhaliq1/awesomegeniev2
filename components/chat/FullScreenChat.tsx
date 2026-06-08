"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Paperclip, SendHorizontal, Sparkles } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { FileUpload } from "./FileUpload";
import { ProgressPanel } from "./ProgressPanel";
import { Logo } from "@/components/shared/Logo";
import styles from "./FullScreenChat.module.css";

type ChatMessageItem = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type StartChatResponse = {
  session: {
    id: string;
    startedAt: string;
    completionScore: number;
    missingFields: string[];
    status: string;
  };
  statusLabel: string;
  message: string;
  firstQuestion: string;
  appText: AppTextLabels;
};

type SendMessageResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
};

type UploadResponse = {
  uploaded: Array<{
    name: string;
    kind: string;
    readable: boolean;
    chunksCreated: number;
    vectorsUpserted: number;
  }>;
};

type AppTextLabels = {
  assistantName: string;
  userName: string;
  productName: string;
  productSubtitle: string;
  assistantBadgeSubtitle: string;
  typingText: string;
  startingText: string;
  dayMarker: string;
  progressTitle: string;
  collectedTitle: string;
  missingTitle: string;
  collectedEmptyText: string;
  missingEmptyText: string;
  inputPlaceholder: string;
  inputAriaLabel: string;
  sendAriaLabel: string;
  uploadLabel: string;
  uploadAriaLabel: string;
  chatAriaLabel: string;
  progressAriaLabel: string;
  startError: string;
  sendError: string;
  sendErrorAssistantMessage: string;
  uploadSuccessPrefix: string;
  uploadError: string;
};

const emptyAppText: AppTextLabels = {
  assistantName: "",
  userName: "",
  productName: "",
  productSubtitle: "",
  assistantBadgeSubtitle: "",
  typingText: "",
  startingText: "",
  dayMarker: "",
  progressTitle: "",
  collectedTitle: "",
  missingTitle: "",
  collectedEmptyText: "",
  missingEmptyText: "",
  inputPlaceholder: "",
  inputAriaLabel: "",
  sendAriaLabel: "",
  uploadLabel: "",
  uploadAriaLabel: "",
  chatAriaLabel: "",
  progressAriaLabel: "",
  startError: "",
  sendError: "",
  sendErrorAssistantMessage: "",
  uploadSuccessPrefix: "",
  uploadError: ""
};

export function FullScreenChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [completionScore, setCompletionScore] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [collectedFields, setCollectedFields] = useState<string[]>([]);
  const [statusLabel, setStatusLabel] = useState("");
  const [appText, setAppText] = useState<AppTextLabels>(emptyAppText);
  const [isStarting, setIsStarting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function startChat() {
      try {
        const response = await fetch("/api/chat/start", {
          method: "POST"
        });

        if (!response.ok) {
          throw new Error();
        }

        const data = (await response.json()) as StartChatResponse;

        if (!isMounted) {
          return;
        }

        setSessionId(data.session.id);
        setCompletionScore(data.session.completionScore);
        setMissingFields(data.session.missingFields);
        setStatusLabel(data.statusLabel);
        setAppText(data.appText);
        setMessages([
          {
            id: `assistant-${data.session.startedAt}`,
            role: "assistant",
            content: data.message
          },
          {
            id: "assistant-first-question",
            role: "assistant",
            content: data.firstQuestion
          }
        ]);
      } catch {
        if (isMounted) {
          setError(appText.startError);
        }
      } finally {
        if (isMounted) {
          setIsStarting(false);
        }
      }
    }

    startChat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, isSending]);

  async function handleSend(message: string) {
    if (!sessionId || isSending) {
      return;
    }

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          message
        })
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = (await response.json()) as SendMessageResponse;

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.message
        }
      ]);
      setCompletionScore(data.completionScore);
      setMissingFields(data.missingFields);
      setCollectedFields(data.collectedFields);
      setStatusLabel(data.statusLabel);
    } catch {
      setError(appText.sendError);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: appText.sendErrorAssistantMessage
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpload(files: FileList) {
    if (!sessionId || isUploading) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);

      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error();
      }

      const data = (await response.json()) as UploadResponse;
      const readableCount = data.uploaded.filter((file) => file.readable).length;
      const assetCount = data.uploaded.length - readableCount;
      const summaryParts = [
        `${data.uploaded.length} file${data.uploaded.length === 1 ? "" : "s"} uploaded`,
        readableCount > 0 ? `${readableCount} readable document${readableCount === 1 ? "" : "s"} added to this chat` : null,
        assetCount > 0 ? `${assetCount} asset file${assetCount === 1 ? "" : "s"} stored` : null
      ].filter(Boolean);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-upload-${Date.now()}`,
          role: "assistant",
          content: `${appText.uploadSuccessPrefix} ${summaryParts.join(". ")}.`
        }
      ]);
    } catch {
      setError(appText.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Logo />
          <div className={styles.brandCopy}>
            <span className={styles.productName}>{appText.productName}</span>
            <p>{appText.productSubtitle}</p>
          </div>
        </div>
        <div className={styles.status}>
          <Sparkles aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className={styles.workspace}>
        <div className={styles.chatColumn}>
          <div
            ref={conversationRef}
            className={styles.conversation}
            aria-label={appText.chatAriaLabel}
          >
            <div className={styles.dayMarker}>{appText.dayMarker}</div>
            {isStarting ? (
              <div className={styles.loadingState}>
                <Loader2 aria-hidden="true" />
                <span>{appText.startingText}</span>
              </div>
            ) : null}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                assistantLabel={appText.assistantName}
                userLabel={appText.userName}
              />
            ))}
            {isSending ? (
              <div className={styles.typingState}>
                <Loader2 aria-hidden="true" />
                <span>{appText.typingText}</span>
              </div>
            ) : null}
            {error ? <div className={styles.errorState}>{error}</div> : null}
          </div>

          <div className={styles.composerWrap}>
            <FileUpload
              icon={<Paperclip aria-hidden="true" />}
              label={appText.uploadLabel}
              ariaLabel={appText.uploadAriaLabel}
              disabled={!sessionId || isStarting || isUploading}
              onUpload={handleUpload}
            />
            <ChatInput
              placeholder={appText.inputPlaceholder}
              inputAriaLabel={appText.inputAriaLabel}
              sendAriaLabel={appText.sendAriaLabel}
              sendIcon={<SendHorizontal aria-hidden="true" />}
              disabled={!sessionId || isStarting || isSending || isUploading}
              onSend={handleSend}
            />
          </div>
        </div>

        <aside className={styles.sidePanel} aria-label={appText.progressAriaLabel}>
          <div className={styles.assistantBadge}>
            <span>
              <Bot aria-hidden="true" />
            </span>
            <div>
              <strong>{appText.assistantName}</strong>
              <p>{appText.assistantBadgeSubtitle}</p>
            </div>
          </div>
          <ProgressPanel
            completionScore={completionScore}
            missingFields={missingFields}
            collectedItems={collectedFields}
            labels={appText}
          />
        </aside>
      </section>
    </main>
  );
}

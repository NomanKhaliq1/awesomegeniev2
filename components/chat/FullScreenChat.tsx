"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Download, Loader2, Paperclip, SendHorizontal, Sparkles } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatCompletionPanel, type FeedbackPayload } from "./ChatCompletionPanel";
import { FileUpload } from "./FileUpload";
import { FlowDetectorPanel, type FlowDetectorState } from "./FlowDetectorPanel";
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
  flowDetector?: FlowDetectorState;
  appText: AppTextLabels;
};

type SessionChatResponse = {
  session: {
    id: string;
    startedAt: string;
    completionScore: number;
    missingFields: string[];
    status: string;
    completed?: boolean;
  };
  statusLabel: string;
  appText: AppTextLabels;
  collectedFields: string[];
  feedback?: {
    rating: number;
    tags: string[];
    comment: string;
    submittedAt: string;
  } | null;
  flowDetector?: FlowDetectorState;
  messages: Array<{
    id: string;
    role: "assistant" | "user" | "system";
    content: string;
    createdAt: string;
  }>;
};

type SendMessageResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
  completed?: boolean;
  flowDetector?: FlowDetectorState;
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

const sessionStorageKey = "awesome-genie-chat-session-id";

function collapseInitialAssistantMessages(messages: ChatMessageItem[]) {
  const leadingAssistantMessages: ChatMessageItem[] = [];
  const restMessages: ChatMessageItem[] = [];
  let isLeadingAssistantBlock = true;

  for (const message of messages) {
    if (isLeadingAssistantBlock && message.role === "assistant") {
      leadingAssistantMessages.push(message);
      continue;
    }

    isLeadingAssistantBlock = false;
    restMessages.push(message);
  }

  if (leadingAssistantMessages.length <= 1) {
    return messages;
  }

  return [
    {
      id: leadingAssistantMessages[0].id,
      role: "assistant" as const,
      content: leadingAssistantMessages.map((message) => message.content).join("\n\n")
    },
    ...restMessages
  ];
}

export function FullScreenChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [completionScore, setCompletionScore] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [collectedFields, setCollectedFields] = useState<string[]>([]);
  const [statusLabel, setStatusLabel] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [flowDetector, setFlowDetector] = useState<FlowDetectorState | null>(null);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [appText, setAppText] = useState<AppTextLabels>(emptyAppText);
  const [isStarting, setIsStarting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function restoreChat(savedSessionId: string) {
      const response = await fetch(`/api/chat/session/${savedSessionId}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Saved chat session could not be restored.");
      }

      const data = (await response.json()) as SessionChatResponse;

      if (!data.session?.id || !Array.isArray(data.messages)) {
        throw new Error("Saved chat session response was invalid.");
      }

      return data;
    }

    async function startChat() {
      try {
        const savedSessionId = window.localStorage.getItem(sessionStorageKey);

        if (savedSessionId) {
          try {
            const restored = await restoreChat(savedSessionId);

            if (!isMounted) {
              return;
            }

            setSessionId(restored.session.id);
            setCompletionScore(restored.session.completionScore);
            setMissingFields(restored.session.missingFields);
            setCollectedFields(restored.collectedFields);
            setStatusLabel(restored.statusLabel);
            setIsCompleted(restored.session.completed === true || restored.session.status === "completed");
            setFeedbackSubmitted(Boolean(restored.feedback));
            setFlowDetector(restored.flowDetector ?? null);
            setAppText(restored.appText);
            setMessages(
              collapseInitialAssistantMessages(
                restored.messages
                  .filter(
                    (
                      message
                    ): message is {
                      id: string;
                      role: "assistant" | "user";
                      content: string;
                      createdAt: string;
                    } => message.role === "assistant" || message.role === "user"
                  )
                  .map((message) => ({
                    id: message.id,
                    role: message.role,
                    content: message.content
                  }))
              )
            );
            return;
          } catch {
            window.localStorage.removeItem(sessionStorageKey);
          }
        }

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
        window.localStorage.setItem(sessionStorageKey, data.session.id);
        setCompletionScore(data.session.completionScore);
        setMissingFields(data.session.missingFields);
        setStatusLabel(data.statusLabel);
        setIsCompleted(false);
        setFeedbackSubmitted(false);
        setFlowDetector(data.flowDetector ?? null);
        setAppText(data.appText);
        setMessages(
          [
            {
              id: `assistant-${data.session.startedAt}`,
              role: "assistant",
              content: data.message
            },
            data.firstQuestion
              ? {
                  id: "assistant-first-question",
                  role: "assistant",
                  content: data.firstQuestion
                }
              : null
          ].filter((message): message is ChatMessageItem => Boolean(message))
        );
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
    if (!sessionId || isSending || isCompleted) {
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
      setIsCompleted(data.completed === true || data.status === "completed");
      setFlowDetector(data.flowDetector ?? flowDetector);
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

  async function startFreshChat() {
      window.localStorage.removeItem(sessionStorageKey);
      setIsStarting(true);
      setError(null);
      setMessages([]);
      setCompletionScore(0);
      setMissingFields([]);
      setCollectedFields([]);
      setStatusLabel("");
      setFlowDetector(null);
      setIsCompleted(false);
      setFeedbackSubmitted(false);

      try {
        const response = await fetch("/api/chat/start", {
          method: "POST"
        });

        if (!response.ok) {
          throw new Error();
        }

        const data = (await response.json()) as StartChatResponse;

        setSessionId(data.session.id);
        window.localStorage.setItem(sessionStorageKey, data.session.id);
        setCompletionScore(data.session.completionScore);
        setMissingFields(data.session.missingFields);
        setStatusLabel(data.statusLabel);
        setFlowDetector(data.flowDetector ?? null);
        setAppText(data.appText);
        setMessages(
          [
            {
              id: `assistant-${data.session.startedAt}`,
              role: "assistant",
              content: data.message
            },
            data.firstQuestion
              ? {
                  id: "assistant-first-question",
                  role: "assistant",
                  content: data.firstQuestion
                }
              : null
          ].filter((message): message is ChatMessageItem => Boolean(message))
        );
      } catch {
        setError(appText.startError);
      } finally {
        setIsStarting(false);
      }
  }

  async function handleClearChat() {
    if (confirm("Are you sure you want to clear this chat and start a new session?")) {
      await startFreshChat();
    }
  }

  async function handleFeedbackSubmit(feedback: FeedbackPayload) {
    if (!sessionId || !isCompleted) return false;

    try {
      const response = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...feedback })
      });

      if (!response.ok) return false;
      setFeedbackSubmitted(true);
      return true;
    } catch {
      return false;
    }
  }

  const handleDownloadChat = () => {
    if (messages.length === 0) {
      alert("No conversation history to download.");
      return;
    }

    const conversationText = messages
      .map((msg) => {
        const sender = msg.role === "user" ? "User" : "Awesome Genie";
        return `[${sender}]:\n${msg.content}\n\n--------------------------------------------------\n`;
      })
      .join("\n");

    const blob = new Blob([conversationText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `awesome-genie-chat-${sessionId || "session"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const flowButtonLabel = flowDetector?.currentStageLabel
    ? `Flow: ${flowDetector.currentStageLabel}`
    : "Flow";

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
        <div className={styles.headerActions}>
          <button
            onClick={handleDownloadChat}
            className={styles.clearButton}
            aria-label="Download conversation history"
          >
            <Download size={16} />
            Download Chat
          </button>
          <div className={styles.flowMenu}>
            <button
              type="button"
              onClick={() => setIsFlowOpen((open) => !open)}
              className={styles.clearButton}
              aria-expanded={isFlowOpen}
              aria-label="Show flow detector"
            >
              <Sparkles size={16} />
              {flowButtonLabel}
              <ChevronDown size={14} />
            </button>
            {isFlowOpen ? (
              <div className={styles.flowPopover}>
                <FlowDetectorPanel flowDetector={flowDetector} />
              </div>
            ) : null}
          </div>
          <button
            onClick={handleClearChat}
            className={styles.clearButton}
          >
            Clear Chat
          </button>
          <div className={styles.status}>
            <Sparkles aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
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

          {isCompleted ? (
            <ChatCompletionPanel
              submitted={feedbackSubmitted}
              onSubmit={handleFeedbackSubmit}
              onStartNewChat={startFreshChat}
            />
          ) : (
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
          )}
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

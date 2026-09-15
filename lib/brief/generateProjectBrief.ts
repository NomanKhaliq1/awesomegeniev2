import { getLangChainModel } from "@/lib/langchain/model";
import { getLatestConversationSummary, listChatMessages } from "@/lib/data/chatRepository";
import {
  listDocumentSourcesForSession,
  listUploadedFilesForSession
} from "@/lib/data/fileRepository";
import { upsertProjectBrief } from "@/lib/data/projectBriefRepository";
import { getClientRequirement } from "@/lib/data/requirementsRepository";
import { getPromptTemplate, renderTemplate } from "@/lib/data/settingsRepository";

export type GeneratedProjectBrief = {
  id: string;
  title: string;
  contentMarkdown: string;
};

export async function generateProjectBrief(sessionId: string): Promise<GeneratedProjectBrief> {
  const [requirement, latestSummary, messages, uploadedFiles, documentSources] =
    await Promise.all([
      getClientRequirement(sessionId),
      getLatestConversationSummary(sessionId),
      listChatMessages(sessionId),
      listUploadedFilesForSession(sessionId),
      listDocumentSourcesForSession(sessionId)
    ]);

  const recentConversation = messages
    .slice(-20)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
    .slice(0, 8000);
  const uploadedFileSummary = uploadedFiles
    .map((file) => {
      return [
        `Name: ${file.original_name}`,
        `Kind: ${file.file_kind}`,
        file.mime_type ? `MIME: ${file.mime_type}` : null,
        file.size_bytes ? `Size: ${file.size_bytes} bytes` : null
      ]
        .filter(Boolean)
        .join(", ");
    })
    .join("\n");
  const documentSummary = documentSources
    .map((source) => {
      return [
        `Title: ${source.title ?? "Uploaded document"}`,
        `Text preview: ${source.extracted_text.slice(0, 1600)}`
      ].join("\n");
    })
    .join("\n\n---\n\n");
  const [system, userTemplate] = await Promise.all([
    getPromptTemplate("brief.generate_system"),
    getPromptTemplate("brief.generate_user")
  ]);

  const model = getLangChainModel({ temperature: 0.2 });
  const userPrompt = renderTemplate(userTemplate, {
    structuredMemory: JSON.stringify(requirement?.structured_memory ?? {}, null, 2),
    conversationSummary: latestSummary?.summary ?? "",
    recentConversation,
    uploadedFiles: uploadedFileSummary || "No uploaded files.",
    uploadedDocumentText: documentSummary || "No readable uploaded document text.",
    missingFields: inferMissingFields(requirement?.structured_memory ?? {}).join(", ")
  });

  const response = await model.invoke([
    { role: "system", content: system },
    { role: "user", content: userPrompt }
  ]);

  const contentMarkdown = response.content as string;

  const title = inferBriefTitle(requirement?.structured_memory ?? {});
  const brief = await upsertProjectBrief({
    sessionId,
    requirementId: requirement?.id ?? null,
    title,
    contentMarkdown,
    contentJson: {
      structuredMemory: requirement?.structured_memory ?? {},
      uploadedFiles: uploadedFiles.map((file) => ({
        id: file.id,
        name: file.original_name,
        kind: file.file_kind
      }))
    }
  });

  return {
    id: brief.id,
    title: brief.title,
    contentMarkdown: brief.content_markdown
  };
}

function inferBriefTitle(memory: Record<string, unknown>) {
  const rawServiceType = cleanTitlePart(memory.service_type) ?? "Project";
  const serviceType =
    rawServiceType.length > 48 ? `${rawServiceType.slice(0, 45).trim()}...` : rawServiceType;
  const companyName = cleanTitlePart(memory.company_name) ?? "Client";

  return `${companyName} - ${serviceType} Brief`;
}

// Clean title helper function
function cleanTitlePart(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    !trimmedValue ||
    ["null", "undefined", "unknown", "not specified", "n/a"].includes(
      trimmedValue.toLowerCase()
    )
  ) {
    return null;
  }

  return trimmedValue;
}

function inferMissingFields(memory: Record<string, unknown>) {
  const required = [
    ["company_name", "Company name"],
    ["contact_name", "Contact person"],
    ["email", "Email"],
    ["service_type", "Service type"],
    ["project_overview", "Project overview"],
    ["business_problem", "Business problem"],
    ["timeline", "Timeline"],
    ["budget_range", "Budget range"],
    ["required_features", "Required features"]
  ];

  return required
    .filter(([key]) => {
      const value = memory[key];
      return typeof value !== "string" || value.trim().length === 0;
    })
    .map(([, label]) => label);
}

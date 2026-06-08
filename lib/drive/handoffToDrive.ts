import { Readable } from "stream";
import { listChatMessages } from "@/lib/data/chatRepository";
import { insertDriveLog, updateProjectBriefDriveFileId } from "@/lib/data/driveRepository";
import {
  downloadStoredFile,
  listDocumentSourcesForSession,
  listUploadedFilesForSession
} from "@/lib/data/fileRepository";
import { getRequirementMemory } from "@/lib/data/requirementsRepository";
import type { GeneratedProjectBrief } from "@/lib/brief/generateProjectBrief";
import {
  createGoogleDriveClient,
  getGoogleDriveRootFolderId,
  isGoogleDriveConfigured
} from "./googleDriveClient";

export type DriveHandoffResult =
  | {
      status: "uploaded";
      folderId: string;
      fileId: string;
      webViewLink: string | null;
    }
  | {
      status: "skipped";
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
    };

export async function handoffBriefToDrive({
  sessionId,
  brief
}: {
  sessionId: string;
  brief: GeneratedProjectBrief;
}): Promise<DriveHandoffResult> {
  if (!isGoogleDriveConfigured()) {
    await insertDriveLog({
      sessionId,
      action: "brief_handoff",
      status: "skipped",
      errorMessage: "Google Drive credentials are not configured."
    });

    return {
      status: "skipped",
      reason: "Google Drive credentials are not configured."
    };
  }

  try {
    const drive = createGoogleDriveClient();
    const rootFolderId = getGoogleDriveRootFolderId();
    const folderName = sanitizeDriveName(`${brief.title} - ${sessionId.slice(0, 8)}`);
    const folderId = await createFolder({
      name: folderName,
      parentId: rootFolderId
    });
    const generatedFolderId = await createFolder({
      name: "Generated Handoff",
      parentId: folderId
    });
    const uploadsFolderId = await createFolder({
      name: "Uploaded Files",
      parentId: folderId
    });
    const [memory, messages, uploadedFiles, documentSources] = await Promise.all([
      getRequirementMemory(sessionId),
      listChatMessages(sessionId),
      listUploadedFilesForSession(sessionId),
      listDocumentSourcesForSession(sessionId)
    ]);
    const briefFile = await uploadTextFile({
      name: `${sanitizeDriveName(brief.title)}.md`,
      parentId: generatedFolderId,
      content: brief.contentMarkdown,
      mimeType: "text/markdown"
    });

    await Promise.all([
      uploadTextFile({
        name: "requirements.json",
        parentId: generatedFolderId,
        content: JSON.stringify(memory, null, 2),
        mimeType: "application/json"
      }),
      uploadTextFile({
        name: "chat-transcript.txt",
        parentId: generatedFolderId,
        content: messages
          .map((message) => `[${message.created_at}] ${message.role}: ${message.content}`)
          .join("\n\n"),
        mimeType: "text/plain"
      }),
      uploadTextFile({
        name: "file-summaries.md",
        parentId: generatedFolderId,
        content: buildFileSummaries(uploadedFiles, documentSources),
        mimeType: "text/markdown"
      }),
      uploadTextFile({
        name: "internal-notes.md",
        parentId: generatedFolderId,
        content: buildInternalNotes({ memory, uploadedFilesCount: uploadedFiles.length }),
        mimeType: "text/markdown"
      })
    ]);

    for (const file of uploadedFiles) {
      const buffer = await downloadStoredFile({
        bucket: file.storage_bucket,
        path: file.storage_path
      });

      await uploadBufferFile({
        name: sanitizeDriveName(file.original_name),
        parentId: uploadsFolderId,
        buffer,
        mimeType: file.mime_type ?? "application/octet-stream"
      });
    }

    await updateProjectBriefDriveFileId({
      briefId: brief.id,
      driveFileId: briefFile.id
    });
    await insertDriveLog({
      sessionId,
      action: "brief_handoff",
      status: "uploaded",
      driveFolderId: folderId,
      driveFileId: briefFile.id,
      metadata: {
        folderName,
        generatedFolderId,
        uploadsFolderId,
        uploadedOriginalFiles: uploadedFiles.length,
        webViewLink: briefFile.webViewLink
      }
    });

    return {
      status: "uploaded",
      folderId,
      fileId: briefFile.id,
      webViewLink: briefFile.webViewLink
    };

    async function createFolder({
      name,
      parentId
    }: {
      name: string;
      parentId: string;
    }) {
      const folder = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId]
        },
        fields: "id",
        supportsAllDrives: true
      });
      const createdFolderId = folder.data.id;

      if (!createdFolderId) {
        throw new Error("Google Drive did not return a folder ID.");
      }

      return createdFolderId;
    }

    async function uploadTextFile({
      name,
      parentId,
      content,
      mimeType
    }: {
      name: string;
      parentId: string;
      content: string;
      mimeType: string;
    }) {
      const file = await drive.files.create({
        requestBody: {
          name,
          parents: [parentId],
          mimeType
        },
        media: {
          mimeType,
          body: Readable.from([content])
        },
        fields: "id, webViewLink",
        supportsAllDrives: true
      });
      const fileId = file.data.id;

      if (!fileId) {
        throw new Error("Google Drive did not return a file ID.");
      }

      return {
        id: fileId,
        webViewLink: file.data.webViewLink ?? null
      };
    }

    async function uploadBufferFile({
      name,
      parentId,
      buffer,
      mimeType
    }: {
      name: string;
      parentId: string;
      buffer: Buffer;
      mimeType: string;
    }) {
      const file = await drive.files.create({
        requestBody: {
          name,
          parents: [parentId],
          mimeType
        },
        media: {
          mimeType,
          body: Readable.from(buffer)
        },
        fields: "id",
        supportsAllDrives: true
      });

      if (!file.data.id) {
        throw new Error("Google Drive did not return an uploaded file ID.");
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Drive error.";

    await insertDriveLog({
      sessionId,
      action: "brief_handoff",
      status: "failed",
      errorMessage: message
    });

    return {
      status: "failed",
      reason: message
    };
  }
}

function buildFileSummaries(
  uploadedFiles: Awaited<ReturnType<typeof listUploadedFilesForSession>>,
  documentSources: Awaited<ReturnType<typeof listDocumentSourcesForSession>>
) {
  if (uploadedFiles.length === 0) {
    return "# File Summaries\n\nNo uploaded files were provided.";
  }

  const documentSourceByFileId = new Map(
    documentSources.map((source) => [source.uploaded_file_id, source])
  );

  return [
    "# File Summaries",
    ...uploadedFiles.map((file) => {
      const documentSource = documentSourceByFileId.get(file.id);

      return [
        `## ${file.original_name}`,
        `- Kind: ${file.file_kind}`,
        `- MIME type: ${file.mime_type ?? "unknown"}`,
        `- Size: ${file.size_bytes ?? 0} bytes`,
        documentSource
          ? `- Readable text preview: ${documentSource.extracted_text.slice(0, 500)}`
          : "- Readable text preview: Not available; stored as asset."
      ].join("\n");
    })
  ].join("\n\n");
}

function buildInternalNotes({
  memory,
  uploadedFilesCount
}: {
  memory: Record<string, unknown>;
  uploadedFilesCount: number;
}) {
  return [
    "# Internal Notes",
    "",
    "- Generated by Awesome Genie from the chat session.",
    `- Uploaded file count: ${uploadedFilesCount}`,
    `- Service type: ${typeof memory.service_type === "string" ? memory.service_type : "Not specified"}`,
    "- Review missing information before scoping or quoting."
  ].join("\n");
}

function sanitizeDriveName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 140);
}

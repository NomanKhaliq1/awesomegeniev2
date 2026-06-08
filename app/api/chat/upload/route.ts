import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  ensureStorageBucket,
  insertDocumentSource,
  insertUploadedFile,
  uploadFileToStorage
} from "@/lib/data/fileRepository";
import { extractTextFromFile } from "@/lib/files/extractText";
import {
  getSessionDocumentNamespace,
  ingestDocumentToPinecone
} from "@/lib/langchain/ingestDocumentToPinecone";

const bucket = "client-uploads";
const maxFileSizeBytes = 15 * 1024 * 1024;
const allowedExtensions = new Set([
  "pdf",
  "docx",
  "xlsx",
  "csv",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "zip",
  "html",
  "json",
  "xml"
]);

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "chat-upload",
    limit: 10,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const sessionId = String(formData.get("sessionId") ?? "");
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required." }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
  }

  try {
    await ensureStorageBucket(bucket);
  } catch (error) {
    console.error("Upload bucket check failed:", error);
    return NextResponse.json({ error: "File storage is not available." }, { status: 500 });
  }

  const uploaded = [];

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: `${file.name} is not an allowed file type.` },
        { status: 400 }
      );
    }

    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { error: `${file.name} is larger than the allowed upload size.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${sessionId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const contentType = file.type || "application/octet-stream";
    const extraction = await extractTextFromFile({
      buffer,
      fileName: file.name,
      mimeType: contentType
    });
    const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileKind = extraction.isReadable ? "document" : "asset";

    try {
      await uploadFileToStorage({
        bucket,
        path: storagePath,
        buffer,
        contentType
      });
    } catch (error) {
      console.error("File upload failed:", error);
      return NextResponse.json({ error: "File upload failed." }, { status: 500 });
    }

    const uploadedFile = await insertUploadedFile({
      sessionId,
      storageBucket: bucket,
      storagePath,
      originalName: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
      fileKind,
      extractedText: extraction.text,
      metadata: {
        contentHash,
        readable: extraction.isReadable
      }
    });

    let chunksCreated = 0;
    let vectorsUpserted = 0;
    let documentSourceId: string | null = null;

    if (extraction.text) {
      const documentSource = await insertDocumentSource({
        uploadedFileId: uploadedFile.id,
        sessionId,
        title: file.name,
        extractedText: extraction.text,
        contentHash,
        pineconeNamespace: await getSessionDocumentNamespace(sessionId)
      });
      const ingestResult = await ingestDocumentToPinecone(documentSource);

      documentSourceId = documentSource.id;
      chunksCreated = ingestResult.chunksCreated;
      vectorsUpserted = ingestResult.vectorsUpserted;
    }

    uploaded.push({
      id: uploadedFile.id,
      name: file.name,
      kind: fileKind,
      readable: extraction.isReadable,
      documentSourceId,
      chunksCreated,
      vectorsUpserted
    });
  }

  return NextResponse.json({
    uploaded
  });
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

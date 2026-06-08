import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ExtractedFileText = {
  text: string | null;
  isReadable: boolean;
};

const textMimeTypes = new Set([
  "text/plain",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "image/svg+xml"
]);

export async function extractTextFromFile({
  buffer,
  fileName,
  mimeType
}: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<ExtractedFileText> {
  const extension = getFileExtension(fileName);

  if (mimeType === "application/pdf" || extension === "pdf") {
    return extractPdf(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    extension === "xlsx"
  ) {
    const workbook = XLSX.read(buffer, {
      type: "buffer"
    });
    const text = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_csv(sheet);
    }).join("\n\n");

    return normalizeExtractedText(text);
  }

  if (textMimeTypes.has(mimeType) || ["txt", "csv", "html", "json", "xml", "svg"].includes(extension)) {
    const rawText = buffer.toString("utf8");

    if (mimeType === "text/html" || extension === "html") {
      const $ = cheerio.load(rawText);
      $("script, style, noscript").remove();
      return normalizeExtractedText($("body").text() || $.root().text());
    }

    return normalizeExtractedText(rawText);
  }

  return {
    text: null,
    isReadable: false
  };
}

async function extractPdf(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse")) as unknown as {
    default?: (data: Buffer) => Promise<{ text: string }>;
  } & ((data: Buffer) => Promise<{ text: string }>);
  const parser = pdfParse.default ?? pdfParse;
  const result = await parser(buffer);

  return normalizeExtractedText(result.text);
}

function normalizeExtractedText(text: string): ExtractedFileText {
  const normalized = text.replace(/\s+/g, " ").trim();

  return {
    text: normalized.length > 0 ? normalized : null,
    isReadable: normalized.length > 0
  };
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

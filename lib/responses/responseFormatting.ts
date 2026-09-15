export function repairInlineSectionFormatting(response: string) {
  let cleaned = response;

  // Remove emojis
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]/gu, "");

  // Canonicalize Next Step headings
  cleaned = cleaned.replace(/^(?:Recommended\s+)?Next\s+Step\b/gim, "Recommended Next Step");

  // Reformat inline bold headings (e.g. "**What we understand**: text" -> "What we understand\n\ntext")
  cleaned = cleaned.replace(
    /(?:^|\n)(?:[-*+]\s+|\d+\.\s+)?(?:#{1,6}\s+)?\*\*(.*?)\*\*\s*[:\-–—]\s*(.*)/gi,
    (match, heading, rest) => `\n\n${heading.trim()}\n\n${rest.trim()}`
  );

  // Reformat standalone bold headings as plain headers (e.g. "**What we understand**:" -> "What we understand")
  cleaned = cleaned.replace(
    /(?:^|\n)(?:#{1,6}\s+)?\*\*(.*?)\*\*\s*:?\s*(?=\n|$)/gi,
    (match, heading) => `\n\n${heading.trim()}\n\n`
  );

  // Repair markdown tables safely
  cleaned = repairMarkdownTables(cleaned);

  // Clean up hashes and multiple blank lines
  cleaned = cleaned
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

export function repairMarkdownTables(response: string): string {
  let cleaned = response;

  cleaned = cleaned.replace(/(:)\s*(\|[^\n]+\|)/g, "$1\n\n$2");

  const rawLines = cleaned.split("\n");
  const expandedLines: string[] = [];

  for (const rawLine of rawLines) {
    const tableStart = rawLine.search(/\|[^|\n]+\|/);
    if (tableStart > 0 && !rawLine.trim().startsWith("|")) {
      const before = rawLine.slice(0, tableStart).trimEnd();
      const after = rawLine.slice(tableStart).trim();
      if (before) {
        expandedLines.push(before);
        expandedLines.push("");
      }
      expandedLines.push(after);
      continue;
    }

    expandedLines.push(rawLine);
  }

  const repaired: string[] = [];
  let insideTable = false;

  for (let i = 0; i < expandedLines.length; i++) {
    const originalLine = expandedLines[i];
    let line = originalLine.trim();
    const looksLikeTableRow = isMarkdownTableLikeRow(line);

    if (!looksLikeTableRow) {
      if (insideTable && line !== "") {
        const prev = repaired[repaired.length - 1];
        if (prev && prev.trim() !== "") {
          repaired.push("");
        }
      }

      repaired.push(originalLine);
      insideTable = false;
      continue;
    }

    const startsNewTable = !insideTable;
    line = normalizeMarkdownTableRow(line);

    const prev = repaired[repaired.length - 1];
    if (prev && prev.trim() !== "" && !isMarkdownTableLikeRow(prev.trim())) {
      repaired.push("");
    }

    repaired.push(line);
    insideTable = true;

    const nextLine = (expandedLines[i + 1] || "").trim();
    const nextIsSeparator = isMarkdownTableSeparatorRow(nextLine);
    const cells = getMarkdownTableCells(line);
    const likelyHeader =
      startsNewTable &&
      cells.length >= 2 &&
      !isMarkdownTableSeparatorRow(line) &&
      cells.some((cell) =>
        /category|what|impact|option|use case|helps|example|service|benefit|workflow|system|synchronization/i.test(cell)
      );

    if (likelyHeader && !nextIsSeparator) {
      repaired.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  }

  return repaired
    .join("\n")
    .replace(/[^\S\r\n]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMarkdownTableLikeRow(line: string) {
  if (!line.includes("|")) {
    return false;
  }

  return getMarkdownTableCells(line).length >= 2;
}

function isMarkdownTableSeparatorRow(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function getMarkdownTableCells(line: string) {
  return line
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function normalizeMarkdownTableRow(line: string) {
  let normalized = line.trim();

  if (!normalized.startsWith("|")) {
    normalized = `| ${normalized}`;
  }

  if (!normalized.endsWith("|")) {
    normalized = `${normalized} |`;
  }

  return normalized;
}


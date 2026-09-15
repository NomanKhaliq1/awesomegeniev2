export type BriefSectionReplacement = {
  section: string;
  content: string;
};

const BRIEF_SECTIONS = [
  "Contact and Company Details",
  "Timeline",
  "Systems Involved",
  "Project Overview",
  "Current Workflow Problem",
  "Workflow Findings from Document",
  "Workflow Details Shared",
  "Business Goals",
  "Recommended First Phase",
  "Possible Later Phases",
  "Information to Confirm During Discovery",
  "Recommended Next Step"
] as const;

export function extractExactSectionReplacements(message: string): BriefSectionReplacement[] {
  const lines = message.replace(/\r\n/g, "\n").split("\n");
  const candidates: Array<{ section: string; start: number; instruction: boolean }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const directSection = canonicalSection(line);
    if (directSection) {
      candidates.push({ section: directSection, start: index + 1, instruction: false });
      continue;
    }

    const instruction = line.match(
      /^(?:update|replace|set)\s+(?:the\s+)?(.+?)(?:\s+section)?\s+(?:to\s+read|with|to)\s*:?\s*$/i
    );
    const instructedSection = instruction ? sectionMention(instruction[1]) : null;
    if (instructedSection) {
      candidates.push({ section: instructedSection, start: index + 1, instruction: true });
    }
  }

  const replacements: BriefSectionReplacement[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const next = candidates
      .slice(index + 1)
      .find((item) => item.start > candidate.start);
    const end = next ? next.start - 1 : lines.length;
    const contentLines: string[] = [];

    for (let lineIndex = candidate.start; lineIndex < end; lineIndex += 1) {
      const value = lines[lineIndex];
      if (/^\s*(?:please\s+)?(?:return|show)\s+only\b/i.test(value)) break;
      if (/^\s*(?:please\s+)?(?:do not|don'?t)\s+(?:repeat|regenerate)\b/i.test(value)) break;
      contentLines.push(value);
    }

    const content = cleanReplacementContent(contentLines.join("\n"));
    if (!content || looksLikeInstructionOnly(content)) continue;

    const existingIndex = replacements.findIndex((item) => item.section === candidate.section);
    const replacement = { section: candidate.section, content };
    if (existingIndex >= 0) replacements[existingIndex] = replacement;
    else replacements.push(replacement);
  }

  return replacements;
}

export function formatSectionReplacements(replacements: BriefSectionReplacement[]) {
  return replacements
    .flatMap(({ section, content }) => [section, "", content, ""])
    .join("\n")
    .trim();
}

export function applySectionReplacements(
  briefMarkdown: string,
  replacements: BriefSectionReplacement[]
) {
  let lines = briefMarkdown.replace(/\r\n/g, "\n").split("\n");

  for (const replacement of replacements) {
    const headingIndex = lines.findIndex((line) => canonicalSection(line) === replacement.section);
    if (headingIndex < 0) {
      if (lines.length && lines.at(-1)?.trim()) lines.push("");
      lines.push(replacement.section, "", replacement.content);
      continue;
    }

    let nextHeadingIndex = lines.length;
    for (let index = headingIndex + 1; index < lines.length; index += 1) {
      if (canonicalSection(lines[index])) {
        nextHeadingIndex = index;
        break;
      }
    }

    const replacementLines = [replacement.section, "", ...replacement.content.split("\n"), ""];
    lines.splice(headingIndex, nextHeadingIndex - headingIndex, ...replacementLines);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function readBriefSection(briefMarkdown: string, section: string) {
  const lines = briefMarkdown.replace(/\r\n/g, "\n").split("\n");
  const headingIndex = lines.findIndex((line) => canonicalSection(line) === section);
  if (headingIndex < 0) return null;

  let end = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (canonicalSection(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(headingIndex + 1, end).join("\n").trim();
}

export function parseStoredSectionReplacements(value: unknown): BriefSectionReplacement[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const replacements: BriefSectionReplacement[] = [];
    for (const [rawSection, rawContent] of Object.entries(parsed)) {
      const section = canonicalSection(rawSection);
      if (!section || typeof rawContent !== "string" || !rawContent.trim()) continue;
      replacements.push({ section, content: rawContent.trim() });
    }
    return replacements;
  } catch {
    return [];
  }
}

export function mergeStoredSectionReplacements(
  currentValue: unknown,
  replacements: BriefSectionReplacement[]
) {
  const merged = new Map(
    parseStoredSectionReplacements(currentValue).map((item) => [item.section, item.content])
  );
  for (const replacement of replacements) merged.set(replacement.section, replacement.content);
  return JSON.stringify(Object.fromEntries(merged));
}

function canonicalSection(value: string) {
  const normalized = value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*{1,2}|\*{1,2}$/g, "")
    .replace(/:\s*$/, "")
    .trim()
    .toLowerCase();
  return BRIEF_SECTIONS.find((section) => section.toLowerCase() === normalized) ?? null;
}

function sectionMention(value: string) {
  const normalized = value.toLowerCase();
  return BRIEF_SECTIONS.find((section) => normalized.includes(section.toLowerCase())) ?? null;
}

function cleanReplacementContent(value: string) {
  let content = value.trim();
  if ((content.startsWith("“") && content.endsWith("”")) ||
      (content.startsWith('"') && content.endsWith('"'))) {
    content = content.slice(1, -1).trim();
  }
  return content;
}

function looksLikeInstructionOnly(value: string) {
  return /^(?:please\s+)?(?:return|show|update|replace|do not|don'?t)\b/i.test(value);
}

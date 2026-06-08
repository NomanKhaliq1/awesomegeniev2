import { load } from "cheerio";
import { createHash } from "node:crypto";

export type ExtractedWebsiteSection = {
  heading: string | null;
  content: string;
  sortOrder: number;
  contentHash: string;
};

export type ExtractedRenderedContent = {
  title: string | null;
  contentHash: string;
  sections: ExtractedWebsiteSection[];
};

export function extractRenderedContent(html: string): ExtractedRenderedContent {
  const $ = load(html);

  $("script, style, noscript, svg, nav, footer, header, form").remove();

  const title = normalizeText($("title").first().text()) || null;
  const main = $("main").first();
  const root = main.length > 0 ? main : $("body");
  const sections: ExtractedWebsiteSection[] = [];
  let currentHeading: string | null = null;
  let currentParts: string[] = [];

  root.find("h1, h2, h3, p, li").each((_index, element) => {
    const tagName = element.tagName.toLowerCase();
    const text = normalizeText($(element).text());

    if (!text || text.length < 3) {
      return;
    }

    if (["h1", "h2", "h3"].includes(tagName)) {
      flushSection();
      currentHeading = text;
      return;
    }

    currentParts.push(text);
  });

  flushSection();

  const dedupedSections = dedupeSections(sections).filter(
    (section) => section.content.length >= 80
  );

  return {
    title,
    contentHash: hashText(dedupedSections.map((section) => section.content).join("\n")),
    sections: dedupedSections.map((section, index) => ({
      ...section,
      sortOrder: index
    }))
  };

  function flushSection() {
    const content = normalizeText(currentParts.join(" "));

    if (content) {
      sections.push({
        heading: currentHeading,
        content,
        sortOrder: sections.length,
        contentHash: hashText(content)
      });
    }

    currentParts = [];
  }
}

function dedupeSections(sections: ExtractedWebsiteSection[]) {
  const seen = new Set<string>();

  return sections.filter((section) => {
    if (seen.has(section.contentHash)) {
      return false;
    }

    seen.add(section.contentHash);
    return true;
  });
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

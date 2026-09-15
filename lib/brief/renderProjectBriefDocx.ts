import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";

type RenderProjectBriefDocxInput = {
  title: string;
  contentMarkdown: string;
};

const brandRed = "B5212F";
const mutedText = "6F6264";
const borderColor = "EAD8DB";

export async function renderProjectBriefDocx({
  title,
  contentMarkdown
}: RenderProjectBriefDocxInput) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: "Awesome Technologies Inc.",
          bold: true,
          color: brandRed,
          size: 24
        })
      ]
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: title, bold: true, color: "161111", size: 34 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 420 },
      children: [
        new TextRun({
          text: `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          })}`,
          color: mutedText,
          size: 20
        })
      ]
    }),
    ...markdownToDocxBlocks(contentMarkdown)
  ];

  const document = new Document({
    creator: "Awesome Genie",
    description: "AwesomeTech project onboarding handoff brief.",
    title,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              right: 1080,
              bottom: 1080,
              left: 1080
            }
          }
        },
        children
      }
    ],
    styles: {
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: {
            font: "Calibri",
            size: 22,
            color: "161111"
          },
          paragraph: {
            spacing: {
              after: 160,
              line: 276
            }
          }
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            bold: true,
            color: brandRed,
            size: 30
          },
          paragraph: {
            spacing: {
              before: 280,
              after: 140
            }
          }
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            bold: true,
            color: "161111",
            size: 25
          },
          paragraph: {
            spacing: {
              before: 220,
              after: 100
            }
          }
        }
      ]
    }
  });

  return Packer.toBuffer(document);
}

function markdownToDocxBlocks(markdown: string) {
  const blocks: Array<Paragraph | Table> = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push(
      new Paragraph({
        children: inlineRuns(paragraphBuffer.join(" ").trim())
      })
    );
    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length === 0) {
      return;
    }

    for (const item of listBuffer) {
      blocks.push(
        new Paragraph({
          bullet: { level: 0 },
          children: inlineRuns(item)
        })
      );
    }
    listBuffer = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      flushParagraph();
      flushList();
      const tableLines = [line];

      while (lines[index + 1]?.trim().startsWith("|")) {
        index += 1;
        tableLines.push(lines[index].trim());
      }

      blocks.push(markdownTableToDocx(tableLines));
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: stripMarkdown(line.slice(2)), bold: true })]
        })
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: stripMarkdown(line.slice(3)), bold: true })]
        })
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(stripMarkdown(line.replace(/^[-*]\s+/, "")));
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function markdownTableToDocx(lines: string[]) {
  const dataRows = lines.filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line));
  const rows = dataRows.map((line, rowIndex) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    return new TableRow({
      children: cells.map(
        (cell) =>
          new TableCell({
            shading: rowIndex === 0 ? { fill: "FAF0F1" } : undefined,
            borders: tableBorders(),
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: stripMarkdown(cell),
                    bold: rowIndex === 0,
                    color: rowIndex === 0 ? brandRed : "161111"
                  })
                ]
              })
            ]
          })
      )
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows
  });
}

function inlineRuns(text: string) {
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*)/g;
  const parts = text.split(pattern).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: stripMarkdown(part), bold: true }));
    } else {
      runs.push(new TextRun({ text: stripMarkdown(part) }));
    }
  }

  return runs;
}

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 1, color: borderColor }
  };
}

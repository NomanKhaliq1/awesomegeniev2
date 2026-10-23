const response = `What I Understand So Far
We are a mortgage company using Encompass, HubSpot, and several vendor systems. Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors. As our loan volume grows, this manual work is becoming harder to manage. You want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.

Key Observations
The current manual process is time-consuming and prone to errors. There are multiple systems involved, including Encompass, HubSpot, and vendor systems.

Possible Underlying Causes
The lack of automation and integration between systems is causing manual effort and inefficiencies. The growing loan volume is exacerbating the issue.

Key Insight
A combination of automation, integrations, and custom Encompass plugin can help streamline loan processing and coordination.

Why It Matters
Streamlining loan processing and coordination can reduce manual effort, improve efficiency, and enhance borrower satisfaction.

Current Understanding
We have identified the need for automation, integrations, and custom Encompass plugin to address the manual work and inefficiencies in the loan processing and coordination process.

Next Question
Can you provide more information about your current loan processing and coordination workflow, including the specific pain points and challenges you are facing?`;

function repairInlineSectionFormatting(response: string) {
  let cleaned = response;

  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]/gu, "");

  const headings = [
    "What I Understand So Far",
    "Key Observations",
    "Possible Underlying Causes",
    "Key Insight",
    "Why It Matters",
    "Current Understanding",
    "Next Question",
    "Discovery Summary",
    "Root Cause Analysis",
    "Key Insights",
    "Solution Landscape",
    "Recommended Approach",
    "Root Cause Being Solved",
    "Evidence Supporting Recommendation",
    "Expected Business Impact",
    "Confidence",
    "Risks",
    "Alternatives Considered",
    "Assumptions",
    "Recommended Next Step",
    "Likely Solution Direction",
    "Information Needed to Prepare the Solution Plan"
  ];

  for (const heading of headings) {
    const inlinePattern = new RegExp(
      `(?:^|\\s)(?:#{1,6}\\s+)?(?:\\*\\*)?\\s*${heading}\\b\\s*(?:\\*\\*)?:?\\s+(?!\\n)`,
      "gi"
    );
    cleaned = cleaned.replace(inlinePattern, `\\n\\n${heading}\\n\\n`);

    const standalonePattern = new RegExp(
      `(?:^|\\s)(?:#{1,6}\\s+)?(?:\\*\\*)?\\s*${heading}\\b\\s*(?:\\*\\*)?:?\\s*(?:\\n|$)`,
      "gi"
    );
    cleaned = cleaned.replace(standalonePattern, `\\n\\n${heading}\\n\\n`);
  }

  cleaned = cleaned
    .replace(/^#{1,6}\\s+/gm, "")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();

  return cleaned;
}

console.log("Original:\n", response);
console.log("\n-------------------\nRepaired:\n", repairInlineSectionFormatting(response));

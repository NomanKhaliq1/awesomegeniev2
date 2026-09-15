import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";

loadEnvConfig(process.cwd());

type ChatResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
};

type TestStatus = "PASS" | "FAIL" | "NEEDS POLISH";

type QaTurn = {
  user: string;
  assistant: string;
};

type QaResult = {
  area: string;
  name: string;
  status: TestStatus;
  notes: string[];
  turns: QaTurn[];
};

const delayMs = Number(process.env.FULL_QA_DELAY_MS ?? "4000");
const turnTimeoutMs = Number(process.env.FULL_QA_TURN_TIMEOUT_MS ?? "150000");

function normalize(text: string) {
  return text.toLowerCase();
}

function hasAny(text: string, terms: string[]) {
  const normalized = normalize(text);
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(normalized);
  });
}

function hasAll(text: string, terms: string[]) {
  const normalized = normalize(text);
  return terms.every((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(normalized);
  });
}

function hasDiscoveryLeak(text: string) {
  return hasAny(text, [
    "What I Understand So Far",
    "Key Observations",
    "Possible Underlying Causes",
    "Current Understanding",
    "Next Question"
  ]);
}

function hasWeakConfirmation(text: string) {
  return hasAny(text, [
    "I need to confirm with the AwesomeTech team",
    "AwesomeTech team can confirm",
    "Would you like me to follow up",
    "I can try to gather more information"
  ]);
}

function isIrrelevantRedirect(text: string) {
  return hasAny(text, [
    "This topic appears unrelated",
    "I can help with software development, automation, integrations",
    "appears unrelated to AwesomeTech services"
  ]);
}

function hasPrematureRecommendation(text: string) {
  return hasAny(text, [
    "Recommended Approach",
    "Phase 1",
    "Phase 2",
    "Phase 3",
    "Root Cause Being Solved",
    "Evidence Supporting Recommendation"
  ]);
}

function hasInlineHeadings(text: string) {
  return /(What I Understand So Far|Discovery Summary|Root Cause Analysis|Solution Landscape|Recommended Approach):\s+\S/.test(
    text
  );
}

function tableLike(text: string) {
  return /\|.+\|/.test(text) || /<table/i.test(text);
}

function markdownReportEscape(text: string) {
  return text.replace(/```/g, "'''");
}

async function sleep() {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${turnTimeoutMs}ms.`)), turnTimeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function evaluate(
  area: string,
  name: string,
  turns: QaTurn[],
  checks: Array<{ ok: boolean; fail: string; polish?: boolean }>
): QaResult {
  const notes: string[] = [];
  let status: TestStatus = "PASS";

  const errorTurn = turns.find((turn) => turn.assistant.startsWith("[ERROR]"));
  if (errorTurn) {
    notes.push(`Assistant turn failed before a valid response: ${errorTurn.assistant}`);
    status = "FAIL";
  }

  for (const check of checks) {
    if (check.ok) {
      continue;
    }

    notes.push(check.fail);

    if (check.polish && status !== "FAIL") {
      status = "NEEDS POLISH";
    } else {
      status = "FAIL";
    }
  }

  if (notes.length === 0) {
    notes.push("Behavior matched the expected criteria.");
  }

  return { area, name, status, notes, turns };
}

async function main() {
  const [{ startSession }, { handleMessage }] = await Promise.all([
    import("@/lib/chat/startSession"),
    import("@/lib/chat/handleMessage")
  ]);

  const results: QaResult[] = [];

  async function freshSession() {
    const session = await startSession();
    return session.id;
  }

  async function send(sessionId: string, user: string): Promise<QaTurn> {
    try {
      const response = await withTimeout(handleMessage(sessionId, user), user.slice(0, 60));
      await sleep();
      return { user, assistant: response.message };
    } catch (error) {
      await sleep();
      return {
        user,
        assistant: `[ERROR] ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async function singleTurn(
    area: string,
    name: string,
    user: string,
    checks: (assistant: string) => Array<{ ok: boolean; fail: string; polish?: boolean }>
  ) {
    const sessionId = await freshSession();
    console.log(`[QA] Starting singleTurn: ${area} - ${name}`);
    const turn = await send(sessionId, user);
    const evalRes = evaluate(area, name, [turn], checks(turn.assistant));
    console.log(`[QA] Finished singleTurn: ${area} - ${name} -> ${evalRes.status}`);
    results.push(evalRes);
  }

  await singleTurn(
    "Knowledge routing",
    "1.1 Encompass plugin comparison table",
    "Can you compare your Encompass plugin use cases in a table?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Encompass plugin question as unrelated." },
      { ok: !hasDiscoveryLeak(assistant), fail: "Entered discovery/onboarding structure for a knowledge question." },
      { ok: tableLike(assistant), fail: "No comparison table was produced." },
      { ok: !hasWeakConfirmation(assistant), fail: "Used weak confirmation/follow-up wording." },
      {
        ok: hasAny(assistant, ["plugin fit", "implementation scope", "project scoping", "scoping"]),
        fail: "Missing enterprise scoping note.",
        polish: true
      }
    ]
  );

  await singleTurn(
    "Knowledge routing",
    "1.2 Encompass plugin overview",
    "Tell me about your Encompass plugins.",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Encompass plugin question as unrelated." },
      { ok: !hasDiscoveryLeak(assistant), fail: "Entered discovery mode instead of product info mode." },
      {
        ok: hasAny(assistant, ["workflow automation", "business rule", "reporting", "crm", "los", "borrower"]),
        fail: "Answer did not include practical Encompass plugin use-case categories."
      },
      { ok: !/full catalog|complete catalog|all plugins/i.test(assistant), fail: "Made an unsupported full catalog claim." }
    ]
  );

  await singleTurn(
    "Pricing safety",
    "1.3 FHA Case Binder exact price",
    "What is the exact price of your FHA Case Binder Plugin?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated FHA Case Binder pricing as unrelated." },
      { ok: !/\$\s?\d+|\b\d{3,}\s?usd\b/i.test(assistant), fail: "Invented or implied an exact price." },
      {
        ok: hasAny(assistant, ["scope", "licensing", "configuration", "integration", "quote", "scoping"]),
        fail: "Did not explain pricing depends on scope/configuration/integration."
      }
    ]
  );

  await singleTurn(
    "Contextual knowledge",
    "2.1 Encompass and HubSpot duplicate updates",
    "We use Encompass and HubSpot. Can your Encompass plugins help with duplicate updates?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Encompass/HubSpot workflow question as unrelated." },
      { ok: !hasDiscoveryLeak(assistant), fail: "Entered discovery structure for contextual knowledge question." },
      { ok: hasAll(assistant, ["Encompass", "HubSpot"]), fail: "Did not use the user's systems." },
      {
        ok: hasAny(assistant, ["duplicate", "data alignment", "sync", "synchronization", "manual updates"]),
        fail: "Did not address duplicate updates/data mismatch clearly."
      },
      { ok: !hasWeakConfirmation(assistant), fail: "Used weak confirmation wording." }
    ]
  );

  {
    const sessionId = await freshSession();
    console.log(`[QA] Starting multi-turn: Contextual memory - 2.2 Multi-turn Encompass workflow context`);
    const first = await send(
      sessionId,
      "We are using Encompass, HubSpot, and title/appraisal vendor systems. Our team manually updates loan statuses in multiple places."
    );
    const second = await send(sessionId, "Can your Encompass plugins help with this workflow?");
    const evalRes = evaluate("Contextual memory", "2.2 Multi-turn Encompass workflow context", [first, second], [
      { ok: hasAll(second.assistant, ["Encompass"]), fail: "Second answer did not carry Encompass context." },
      { ok: hasAny(second.assistant, ["HubSpot", "CRM"]), fail: "Second answer did not carry HubSpot/CRM context." },
      {
        ok: hasAny(second.assistant, ["vendor", "title", "appraisal"]),
        fail: "Second answer did not use vendor coordination context.",
        polish: true
      },
      {
        ok: !/which systems|what systems/i.test(second.assistant),
        fail: "Asked again which systems are used."
      }
    ]);
    console.log(`[QA] Finished multi-turn: Contextual memory - 2.2 Multi-turn Encompass workflow context -> ${evalRes.status}`);
    results.push(evalRes);
  }

  {
    const sessionId = await freshSession();
    console.log(`[QA] Starting multi-turn: Onboarding discovery - 3.1 First project message`);
    const t1 = await send(
      sessionId,
      `We are a mortgage company using Encompass, HubSpot, and several vendor systems.

Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.

As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`
    );
    const evalRes1 = evaluate("Onboarding discovery", "3.1 First project message", [t1], [
      {
        ok: !hasDiscoveryLeak(t1.assistant) && !hasAny(t1.assistant, ["Key Insight", "Why It Matters", "Current Understanding"]),
        fail: "Outdated discovery headings/meta-explanations were present in response."
      },
      {
        ok: hasAny(t1.assistant, ["walk me through", "process works today", "how this process works"]),
        fail: "First project response did not prompt for current process."
      },
      { ok: !hasPrematureRecommendation(t1.assistant), fail: "Produced premature final recommendation." },
      { ok: !hasAny(t1.assistant, ["MISMO", "Salesforce"]), fail: "Introduced unsupported MISMO/Salesforce." },
      { ok: !hasInlineHeadings(t1.assistant), fail: "Used inline headings instead of readable sections." }
    ]);
    console.log(`[QA] Finished multi-turn step 3.1 -> ${evalRes1.status}`);
    results.push(evalRes1);

    console.log(`[QA] Starting multi-turn: Onboarding discovery - 3.2 Workflow details follow-up`);
    const t2 = await send(
      sessionId,
      `The biggest manual effort happens between application intake, processing, underwriting, and closing.

Processors manually update loan statuses in Encompass, update HubSpot records, notify borrowers, and follow up with title and appraisal vendors.

The same information often gets updated in multiple places, and different teams need visibility into the same loan status.`
    );
    const evalRes2 = evaluate("Onboarding discovery", "3.2 Workflow details follow-up", [t2], [
      {
        ok: hasAny(t2.assistant, ["duplicate", "visibility", "borrower", "vendor", "workflow", "HubSpot"]),
        fail: "Did not use provided workflow details."
      },
      { ok: !/which part creates the most manual effort/i.test(t2.assistant), fail: "Repeated already answered workflow-stage question." },
      { ok: !hasAny(t2.assistant, ["MISMO", "Salesforce"]), fail: "Introduced unsupported MISMO/Salesforce." }
    ]);
    console.log(`[QA] Finished multi-turn step 3.2 -> ${evalRes2.status}`);
    results.push(evalRes2);

    console.log(`[QA] Starting multi-turn: Recommendation timing - 3.3 Goals and volume`);
    const t3 = await send(
      sessionId,
      `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across processing, underwriting, and closing teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.

We process around 700 loans per month and expect the volume to keep growing.`
    );
    const evalRes3 = evaluate("Recommendation timing", "3.3 Goals and volume", [t3], [
      {
        ok: hasAny(t3.assistant, ["Encompass", "HubSpot", "workflow", "borrower", "vendor", "visibility"]),
        fail: "Recommendation/analysis was not concrete to collected facts."
      },
      { ok: !hasAny(t3.assistant, ["MISMO", "Salesforce"]), fail: "Introduced unsupported MISMO/Salesforce." },
      { ok: !hasInlineHeadings(t3.assistant), fail: "Used inline headings.", polish: true }
    ]);
    console.log(`[QA] Finished multi-turn step 3.3 -> ${evalRes3.status}`);
    results.push(evalRes3);

    console.log(`[QA] Starting multi-turn: Closing flow - 3.4 Closing / next step`);
    const t4 = await send(
      sessionId,
      "This sounds aligned with what we need. What would be the next step if we want AwesomeTech to evaluate this properly and prepare a solution plan?"
    );
    const evalRes4 = evaluate("Closing flow", "3.4 Closing / next step", [t4], [
      {
        ok: hasAny(t4.assistant, ["Recommended Next Step", "next step", "scoping", "solution plan"]),
        fail: "Did not move toward scoping/next step."
      },
      { ok: !hasDiscoveryLeak(t4.assistant), fail: "Restarted discovery in closing step." },
      {
        ok: hasAny(t4.assistant, ["contact", "email", "timeline", "workflow", "documents", "loan volume", "systems"]),
        fail: "Did not request enough information for solution planning.",
        polish: true
      }
    ]);
    console.log(`[QA] Finished multi-turn step 3.4 -> ${evalRes4.status}`);
    results.push(evalRes4);

    console.log(`[QA] Starting multi-turn: Lead capture - 3.5 Contact capture`);
    const t5 = await send(
      sessionId,
      "Sure. My name is John Carter, I'm the Operations Manager at ABC Mortgage. My email is john@abcmortgage.com. We'd like to review this within the next 2 weeks."
    );
    const evalRes5 = evaluate("Lead capture", "3.5 Contact capture", [t5], [
      { ok: hasAny(t5.assistant, ["John", "ABC Mortgage", "2 weeks", "next step", "scoping"]), fail: "Did not acknowledge/summarize contact details." },
      { ok: !/what is your name|your email|company name/i.test(t5.assistant), fail: "Asked again for already provided contact info." }
    ]);
    console.log(`[QA] Finished multi-turn step 3.5 -> ${evalRes5.status}`);
    results.push(evalRes5);

    console.log(`[QA] Starting multi-turn: Context-aware document upload - 3.6 Workflow document upload`);
    const t6 = await send(
      sessionId,
      "We will share the workflow document from our side. It includes current loan status update process, HubSpot update points, borrower notification triggers, title and appraisal vendor follow-up steps, duplicated fields between Encompass and HubSpot, and manual handoff points. Should we upload it here now so AwesomeTech can review it before the discovery session?"
    );
    const evalRes6 = evaluate("Context-aware document upload", "3.6 Workflow document upload", [t6], [
      { ok: !isIrrelevantRedirect(t6.assistant), fail: "Incorrectly treated workflow document upload as unrelated." },
      { ok: hasAny(t6.assistant, ["upload", "share"]), fail: "Did not tell the client they can upload/share the workflow document." },
      { ok: hasAny(t6.assistant, ["directly related", "same project", "project we are scoping"]), fail: "Did not acknowledge it is related to the active project." },
      { ok: hasAny(t6.assistant, ["loan status", "HubSpot", "borrower notification", "vendor", "duplicated", "manual handoff"]), fail: "Did not mention what AwesomeTech will review." },
      { ok: hasAny(t6.assistant, ["project brief", "sales", "implementation"]), fail: "Did not mention updating project brief / sales / implementation team." }
    ]);
    console.log(`[QA] Finished multi-turn step 3.6 -> ${evalRes6.status}`);
    results.push(evalRes6);

    console.log(`[QA] Starting multi-turn: Irrelevant during onboarding - 3.7 Marvel remains out-of-domain`);
    const t7 = await send(sessionId, "Can you tell me about Marvel movies?");
    const evalRes7 = evaluate("Irrelevant during onboarding", "3.7 Marvel remains out-of-domain", [t7], [
      { ok: isIrrelevantRedirect(t7.assistant), fail: "Marvel question was not redirected during active onboarding." },
      { ok: !hasAny(t7.assistant, ["Iron Man", "Captain America", "Avengers", "Spider-Man"]), fail: "Answered Marvel trivia during onboarding." }
    ]);
    console.log(`[QA] Finished multi-turn step 3.7 -> ${evalRes7.status}`);
    results.push(evalRes7);
  }

  await singleTurn(
    "Irrelevant queries",
    "5.1 Marvel out-of-domain redirect",
    "Can you tell me about Marvel movies?",
    (assistant) => [
      { ok: !hasAny(assistant, ["Iron Man", "Captain America", "Avengers", "Spider-Man"]), fail: "Answered general Marvel trivia." },
      {
        ok: hasAny(assistant, ["AwesomeTech", "software", "automation", "AI", "integrations", "CRM", "Encompass"]),
        fail: "Did not redirect to AwesomeTech relevant scope."
      }
    ]
  );

  await singleTurn(
    "Language behavior",
    "6.1 English AI automation",
    "Can you explain your AI automation services?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated AI automation question as unrelated." },
      { ok: !hasAny(assistant, ["aap", "mujhe", "kar sakte", "hain"]), fail: "Did not stay in English.", polish: true },
      { ok: hasAny(assistant, ["AI", "automation", "workflow", "software"]), fail: "Did not answer AI automation topic." }
    ]
  );

  await singleTurn(
    "Language behavior",
    "6.2 Roman Urdu AI automation",
    "Aap mujhy apni AI automation services explain kar skty ho?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Roman Urdu AI automation question as unrelated." },
      { ok: hasAny(assistant, ["aap", "apki", "hum", "kar", "hain", "ho"]), fail: "Did not respond in Roman Urdu.", polish: true },
      { ok: hasAny(assistant, ["AI", "automation", "workflow", "software"]), fail: "Did not answer AI automation topic." }
    ]
  );

  await singleTurn(
    "Metric safety",
    "7.1 Fake Metric Test",
    "We want to reduce manual work, but we do not have exact numbers yet.",
    (assistant) => [
      { ok: !/\b(30%|25%|ROI)\b/i.test(assistant), fail: "Response generated fake percentages or ROI metrics." },
      { ok: !/\$\s?\d+/i.test(assistant), fail: "Response generated fake dollar savings." },
      { ok: !/\b(?:\d+)\s*(?:weeks?|months?)\b/i.test(assistant), fail: "Response generated fake project delivery timeline." }
    ]
  );

  await singleTurn(
    "Language behavior",
    "7.2 Roman Urdu Knowledge Test",
    "Aap mujhy apni AI automation services simple words mein explain kar skty ho?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Roman Urdu AI automation question as unrelated." },
      { ok: hasAny(assistant, ["aap", "apki", "hum", "kar", "hain", "ho", "bata"]), fail: "Did not respond in Roman Urdu." }
    ]
  );

  await singleTurn(
    "Language behavior",
    "7.3 Roman Urdu Onboarding Test",
    "Hum Encompass aur HubSpot use krty hein, duplicate updates bhot hoti hein. Isko automate krwana ha.",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Roman Urdu onboarding question as unrelated." },
      { ok: hasAny(assistant, ["aap", "apki", "hum", "kar", "hain", "ho", "samjh", "chuka"]), fail: "Did not respond in Roman Urdu." },
      { ok: hasAny(assistant, ["encompass", "hubspot", "automate", "automation"]), fail: "Did not capture relevant systems in response." }
    ]
  );

  await singleTurn(
    "Structured formatting",
    "7.4 No Forced Table Test",
    "Can your Encompass plugins help with duplicate updates?",
    (assistant) => [
      { ok: !isIrrelevantRedirect(assistant), fail: "Incorrectly treated Encompass question as unrelated." },
      { ok: !tableLike(assistant), fail: "Produced a forced table for a direct knowledge question." }
    ]
  );

  await singleTurn(
    "Lead capture safety",
    "7.5 Lead Capture Metric Safety Test",
    "My name is John Carter, I’m the Operations Manager at ABC Mortgage. My email is john@abcmortgage.com. We’d like to review this within the next 2 weeks.",
    (assistant) => [
      { ok: hasAny(assistant, ["John", "Carter", "ABC Mortgage", "2 weeks", "next step", "scoping"]), fail: "Did not acknowledge contact details/next step correctly." },
      { ok: !/\b(30% reduction|25% decrease|ROI|guaranteed savings|guaranteed delivery date)\b/i.test(assistant), fail: "Hallucinated metrics, ROI, or guaranteed savings." },
      { ok: !/\b(30%|25%)\b/.test(assistant), fail: "Generated fake percentages." }
    ]
  );

  const passCount = results.filter((result) => result.status === "PASS").length;
  const failCount = results.filter((result) => result.status === "FAIL").length;
  const polishCount = results.filter((result) => result.status === "NEEDS POLISH").length;
  const overall: TestStatus = failCount > 0 ? "FAIL" : polishCount > 0 ? "NEEDS POLISH" : "PASS";

  const lines = [
    "# Awesome Genie Full Chatbot QA Report",
    "",
    "## QA Summary",
    "",
    `Overall Status: ${overall}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `Totals: ${passCount} PASS, ${polishCount} NEEDS POLISH, ${failCount} FAIL`,
    "",
    "## Test Results",
    "",
    "| Test Area | Status | Notes |",
    "| --- | --- | --- |",
    ...results.map((result) => {
      const note = result.notes.join(" ");
      return `| ${result.area} - ${result.name} | ${result.status} | ${note.replace(/\|/g, "/")} |`;
    }),
    "",
    "## Critical Issues Found",
    "",
    ...results
      .filter((result) => result.status === "FAIL")
      .flatMap((result) => [`- ${result.area} - ${result.name}: ${result.notes.join(" ")}`]),
    ...(failCount === 0 ? ["- None from automated assistant QA."] : []),
    "",
    "## Polish Issues",
    "",
    ...results
      .filter((result) => result.status === "NEEDS POLISH")
      .flatMap((result) => [`- ${result.area} - ${result.name}: ${result.notes.join(" ")}`]),
    ...(polishCount === 0 ? ["- None from automated assistant QA."] : []),
    "",
    "## Exact Transcripts",
    "",
    ...results.flatMap((result) => [
      `### ${result.area} - ${result.name} - ${result.status}`,
      "",
      ...result.turns.flatMap((turn, index) => [
        `#### Turn ${index + 1} User`,
        "",
        "```txt",
        markdownReportEscape(turn.user),
        "```",
        "",
        `#### Turn ${index + 1} Assistant`,
        "",
        "```txt",
        markdownReportEscape(turn.assistant),
        "```",
        ""
      ])
    ]),
    "## Client Demo Readiness",
    "",
    overall === "FAIL" ? "Not ready yet" : overall === "NEEDS POLISH" ? "Ready after minor polish" : "Ready for demo",
    "",
    "## Production Readiness",
    "",
    "Needs final QA/security"
  ];

  await writeFile("QA_CHATBOT_REPORT.md", `${lines.join("\n")}\n`, "utf8");

  console.log(`Full chatbot QA complete: ${passCount} PASS, ${polishCount} NEEDS POLISH, ${failCount} FAIL.`);
  console.log("Report written to QA_CHATBOT_REPORT.md");

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Full chatbot QA failed:");
  console.error(error);
  process.exit(1);
});

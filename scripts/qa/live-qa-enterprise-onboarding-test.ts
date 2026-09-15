import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type ChatResponse = {
  message: string;
  completionScore: number;
  missingFields: string[];
  collectedFields: string[];
  status: string;
  statusLabel: string;
};

const delayMs = Number(process.env.ENTERPRISE_QA_DELAY_MS ?? "12000");
const turnTimeoutMs = Number(process.env.ENTERPRISE_QA_TURN_TIMEOUT_MS ?? "150000");

const firstProblemMessage = `We are a mortgage company using Encompass, HubSpot, and several vendor systems.

Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.

As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`;

const workflowDetailsMessage = `The biggest manual effort happens between application intake, processing, underwriting, and closing.

Processors manually update loan statuses in Encompass, update HubSpot records, notify borrowers, and follow up with title and appraisal vendors.

The same information often gets updated in multiple places, and different teams need visibility into the same loan status.`;

const goalsAndVolumeMessage = `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.

We process around 700 loans per month and expect volume to keep growing.`;

const closingMessage =
  "This sounds aligned with what we need. What would be the next step if we want AwesomeTech to evaluate this properly and prepare a solution plan?";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text: string, expected: string, label: string) {
  assert(
    text.toLowerCase().includes(expected.toLowerCase()),
    `${label}: expected response to include "${expected}".`
  );
}

function assertIncludesAny(text: string, expected: string[], label: string) {
  const normalized = text.toLowerCase();
  assert(
    expected.some((item) => normalized.includes(item.toLowerCase())),
    `${label}: expected response to include one of ${expected.join(", ")}.`
  );
}

function assertNotIncludes(text: string, banned: string, label: string) {
  assert(
    !text.toLowerCase().includes(banned.toLowerCase()),
    `${label}: response should not include "${banned}".`
  );
}

function assertNoInlineSectionHeadings(text: string, label: string) {
  const inlineHeadingPattern =
    /(What I Understand So Far|Key Observations|Possible Underlying Causes|Key Insight|Why It Matters|Current Understanding|Next Question|Discovery Summary|Root Cause Analysis|Solution Landscape|Recommended Approach):\s+\S/;

  assert(!inlineHeadingPattern.test(text), `${label}: response contains inline section headings.`);
}

function assertNoUnsupportedSystemJump(text: string, sourceMessage: string, label: string) {
  if (!sourceMessage.toLowerCase().includes("mismo")) {
    assertNotIncludes(text, "MISMO", label);
  }

  if (!sourceMessage.toLowerCase().includes("salesforce")) {
    assertNotIncludes(text, "Salesforce", label);
  }
}

function assertNoFinalRecommendation(text: string, label: string) {
  assertNotIncludes(text, "Recommended Approach", label);
  assertNotIncludes(text, "Phase 1", label);
  assertNotIncludes(text, "Phase 2", label);
  assertNotIncludes(text, "Phase 3", label);
  assertNotIncludes(text, "Root Cause Being Solved", label);
  assertNotIncludes(text, "Evidence Supporting Recommendation", label);
}

async function sleep() {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${turnTimeoutMs}ms.`));
    }, turnTimeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function main() {
  const [{ startSession }, { handleMessage }, { getRequirementMemory }] = await Promise.all([
    import("@/lib/chat/startSession"),
    import("@/lib/chat/handleMessage"),
    import("@/lib/data/requirementsRepository")
  ]);

  const session = await startSession();
  const sessionId = session.id;

  console.log("Enterprise onboarding QA started");
  console.log(`Session: ${sessionId}`);

  async function send(label: string, userMessage: string): Promise<ChatResponse> {
    console.log(`\n--- ${label} ---`);
    console.log(`User:\n${userMessage}`);

    const response = await withTimeout(handleMessage(sessionId, userMessage), label);
    console.log(`Assistant:\n${response.message}`);
    console.log(
      `Metrics: completion=${response.completionScore}, status=${response.status}, collected=${response.collectedFields.join(", ")}`
    );

    await sleep();
    return response;
  }

  const first = await send("Test 1: First onboarding message", firstProblemMessage);
  assertNotIncludes(first.message, "What I Understand So Far", "Test 1");
  assertNotIncludes(first.message, "Key Observations", "Test 1");
  assertNotIncludes(first.message, "Possible Underlying Causes", "Test 1");
  assertNotIncludes(first.message, "Next Question", "Test 1");
  assertIncludesAny(first.message, ["walk me through", "process works today", "how this process works"], "Test 1");
  assertNoFinalRecommendation(first.message, "Test 1");
  assertNoUnsupportedSystemJump(first.message, firstProblemMessage, "Test 1");
  assertNoInlineSectionHeadings(first.message, "Test 1");

  const second = await send("Test 2: Workflow details follow-up", workflowDetailsMessage);
  assertNoUnsupportedSystemJump(second.message, workflowDetailsMessage, "Test 2");
  assertNoInlineSectionHeadings(second.message, "Test 2");
  assertIncludesAny(
    second.message,
    ["duplicate", "workflow", "visibility", "HubSpot", "borrower", "vendor", "Encompass"],
    "Test 2"
  );

  const third = await send("Test 3: Goals and volume", goalsAndVolumeMessage);
  assertNoUnsupportedSystemJump(third.message, goalsAndVolumeMessage, "Test 3");
  assertNoInlineSectionHeadings(third.message, "Test 3");

  if (third.message.toLowerCase().includes("recommended approach")) {
    assertIncludesAny(third.message, ["Encompass", "HubSpot"], "Test 3 recommendation");
    assertIncludesAny(third.message, ["Workflow Automation", "synchronization", "notification"], "Test 3 recommendation");
  }

  const fourth = await send("Test 4: Closing", closingMessage);
  assertNoInlineSectionHeadings(fourth.message, "Test 4");
  assertIncludesAny(fourth.message, ["Recommended Next Step", "next step", "scoping"], "Test 4");
  assertIncludesAny(fourth.message, ["workflow scoping", "scoping session", "solution plan"], "Test 4");
  assertNotIncludes(fourth.message, "What I Understand So Far", "Test 4");

  const memory = await getRequirementMemory(sessionId);
  console.log("\nFinal structured memory:");
  console.log(JSON.stringify(memory, null, 2));
  console.log("\nEnterprise onboarding QA passed.");
}

main().catch((error) => {
  console.error("Enterprise onboarding QA failed:");
  console.error(error);
  process.exit(1);
});

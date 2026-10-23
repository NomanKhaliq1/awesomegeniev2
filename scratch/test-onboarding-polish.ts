import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function runTests() {
  const { handleMessage } = await import("../lib/chat/handleMessage");
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  // Create a single session for all 4 turns
  const { data: session, error } = await supabase
    .from("chat_sessions")
    .insert({
      status: "collecting_core",
      completion_score: 0,
      missing_fields: []
    })
    .select("id")
    .single();

  if (error || !session) {
    console.error("Failed to create session:", error);
    process.exit(1);
  }

  const sessionId = session.id;
  console.log(`Starting chronological test session: ${sessionId}`);

  let allPassed = true;
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // =================== TURN 1 ===================
  console.log("\n=================== TURN 1 ===================");
  const input1 = `We are a mortgage company using Encompass, HubSpot, and several vendor systems.
Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.
As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`;
  
  console.log(`Query:\n"${input1}"`);
  const response1 = await handleMessage(sessionId, input1);
  const msg1 = response1.message;
  const lower1 = msg1.toLowerCase();
  console.log(`\nResponse:\n${msg1}\n`);

  const checks1 = {
    usesEarlyDiscovery: msg1.includes("What I Understand So Far") && msg1.includes("Possible Underlying Causes") && msg1.includes("Next Question"),
    noEarlyRecommendation: !msg1.includes("Recommended Approach") && !msg1.includes("Phase 1") && !msg1.includes("Phase 2") && !msg1.includes("Risks"),
    noUnsupportedSystems: !lower1.includes("mismo") && !lower1.includes("salesforce"),
    noHashes: !msg1.includes("#"),
    hasSpacing: msg1.includes("\n\nWhat I Understand So Far\n\n") || msg1.includes("What I Understand So Far\n\n")
  };

  console.log("Validation Results (Turn 1):");
  console.log("  - Uses early discovery structure:", checks1.usesEarlyDiscovery ? "PASS" : "FAIL");
  console.log("  - No early recommendation/phases:", checks1.noEarlyRecommendation ? "PASS" : "FAIL");
  console.log("  - No MISMO or Salesforce mentioned:", checks1.noUnsupportedSystems ? "PASS" : "FAIL");
  console.log("  - No markdown heading hashes (#):", checks1.noHashes ? "PASS" : "FAIL");
  console.log("  - Clean spacing/section headings:", checks1.hasSpacing ? "PASS" : "FAIL");

  if (!Object.values(checks1).every(Boolean)) allPassed = false;

  // =================== TURN 2 ===================
  console.log("\n=================== TURN 2 ===================");
  const input2 = `The biggest manual effort happens between application intake, processing, underwriting, and closing.
Processors manually update loan statuses in Encompass, update HubSpot records, notify borrowers, and follow up with title and appraisal vendors.
The same information often gets updated in multiple places, and different teams need visibility into the same loan status.`;

  console.log(`Query:\n"${input2}"`);
  console.log("Sleeping 65s to avoid Groq rate limits...");
  await sleep(65000);
  const response2 = await handleMessage(sessionId, input2);
  const msg2 = response2.message;
  const lower2 = msg2.toLowerCase();
  console.log(`\nResponse:\n${msg2}\n`);

  const checks2 = {
    usesMidConfidence: msg2.includes("Discovery Summary") && msg2.includes("Solution Landscape"),
    hasTable: msg2.includes("|") && msg2.includes("Option"),
    noFinalRecommendation: !msg2.includes("Recommended Approach"),
    mentionsGaps: lower2.includes("visibility") || lower2.includes("sync") || lower2.includes("duplicate") || lower2.includes("status")
  };

  console.log("Validation Results (Turn 2):");
  console.log("  - Uses mid-confidence landscape structure:", checks2.usesMidConfidence ? "PASS" : "FAIL");
  console.log("  - Solution Landscape is a markdown table:", checks2.hasTable ? "PASS" : "FAIL");
  console.log("  - No final recommendation yet:", checks2.noFinalRecommendation ? "PASS" : "FAIL");
  console.log("  - Mentions operational workflow gaps:", checks2.mentionsGaps ? "PASS" : "FAIL");

  if (!Object.values(checks2).every(Boolean)) allPassed = false;

  // =================== TURN 3 ===================
  console.log("\n=================== TURN 3 ===================");
  const input3 = `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.
We process around 700 loans per month and expect volume to keep growing.`;

  console.log(`Query:\n"${input3}"`);
  console.log("Sleeping 65s to avoid Groq rate limits...");
  await sleep(65000);
  const response3 = await handleMessage(sessionId, input3);
  const msg3 = response3.message;
  const lower3 = msg3.toLowerCase();
  console.log(`\nResponse:\n${msg3}\n`);

  const checks3 = {
    usesHighConfidence: msg3.includes("Recommended Approach") && msg3.includes("Evidence Supporting Recommendation"),
    concreteRecommendation: lower3.includes("hubspot") || lower3.includes("synchronization") || lower3.includes("workflow automation") || lower3.includes("workflow orchestration") || lower3.includes("automation") || lower3.includes("orchestration"),
    noUnsupportedSystems: !lower3.includes("mismo") && !lower3.includes("salesforce"),
    properSpacing: !msg3.match(/[A-Za-z0-9]+:\s*[A-Za-z0-9]+/g) // check that headings aren't inline
  };

  console.log("Validation Results (Turn 3):");
  console.log("  - Uses high-confidence recommended structure:", checks3.usesHighConfidence ? "PASS" : "FAIL");
  console.log("  - Recommended approach is concrete (HubSpot/Encompass Sync):", checks3.concreteRecommendation ? "PASS" : "FAIL");
  console.log("  - No Salesforce or MISMO mentioned:", checks3.noUnsupportedSystems ? "PASS" : "FAIL");
  console.log("  - Section headings are not inline:", checks3.properSpacing ? "PASS" : "FAIL");

  if (!Object.values(checks3).every(Boolean)) allPassed = false;

  // =================== TURN 4 ===================
  console.log("\n=================== TURN 4 ===================");
  const input4 = `This sounds aligned with what we need. What would be the next step if we want AwesomeTech to evaluate this properly and prepare a solution plan?`;

  console.log(`Query:\n"${input4}"`);
  console.log("Sleeping 65s to avoid Groq rate limits...");
  await sleep(65000);
  const response4 = await handleMessage(sessionId, input4);
  const msg4 = response4.message;
  const lower4 = msg4.toLowerCase();
  console.log(`\nResponse:\n${msg4}\n`);

  const checks4 = {
    usesClosingStructure: msg4.includes("Recommended Next Step") && msg4.includes("Likely Solution Direction") && msg4.includes("Information Needed to Prepare the Solution Plan"),
    mentionsScoping: lower4.includes("scoping") || lower4.includes("scoping session"),
    noDiscoveryRestart: !msg4.includes("What I Understand So Far")
  };

  console.log("Validation Results (Turn 4):");
  console.log("  - Uses next-step closing structure:", checks4.usesClosingStructure ? "PASS" : "FAIL");
  console.log("  - Mentions workflow scoping session:", checks4.mentionsScoping ? "PASS" : "FAIL");
  console.log("  - Does not restart discovery:", checks4.noDiscoveryRestart ? "PASS" : "FAIL");

  if (!Object.values(checks4).every(Boolean)) allPassed = false;

  console.log("\n=================== FINAL STATUS ===================");
  console.log(allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  if (!allPassed) process.exit(1);
}

runTests().catch(console.error);

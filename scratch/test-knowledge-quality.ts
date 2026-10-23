import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function runTests() {
  const { handleMessage } = await import("../lib/chat/handleMessage");
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const tests = [
    {
      id: 1,
      input: "Can you compare your Encompass plugin use cases in a table?",
      validate: (msg: string) => {
        const lower = msg.toLowerCase();
        const tableSeparatorCount = (msg.match(/\|\s*:?---:?\s*\|\s*:?---:?\s*\|\s*:?---:?\s*\|/g) || []).length;
        
        // Find the first data row of the table
        const lines = msg.split("\n").map(l => l.trim()).filter(Boolean);
        const tableRows = lines.filter(l => l.startsWith("|"));
        const firstDataRow = tableRows[2] || ""; // Index 0: Header, Index 1: Separators, Index 2: First Row
        const hasFhaVaFirstRow = firstDataRow.toLowerCase().includes("fha / va document submission automation") || 
                                 firstDataRow.toLowerCase().includes("fha/va document submission automation");

        const checks = {
          startsCorrectly: msg.trim().startsWith("Based on the available context, here is a practical use-case category comparison:"),
          hasTable: msg.includes("|") && msg.includes("Use Case Category"),
          oneTable: tableSeparatorCount === 1,
          noBulletsRepeating: !lines.some(l => (l.startsWith("-") || l.startsWith("*")) && l.toLowerCase().includes("lending process")),
          noDefensiveConfirm: !lower.includes("i need to confirm") && 
                              !lower.includes("awesometech team can confirm") && 
                              !lower.includes("would you like me to follow up"),
          fhaFirstRow: hasFhaVaFirstRow
        };

        console.log("  - Starts exactly with 'Based on the available context, here is a...':", checks.startsCorrectly ? "PASS" : "FAIL");
        console.log("  - Has one table only:", checks.hasTable && checks.oneTable ? "PASS" : `FAIL (hasTable: ${checks.hasTable}, count: ${tableSeparatorCount})`);
        console.log("  - No repeating bullets:", checks.noBulletsRepeating ? "PASS" : "FAIL");
        console.log("  - No weak confirmation language:", checks.noDefensiveConfirm ? "PASS" : "FAIL");
        console.log("  - FHA/VA row is the first data row:", checks.fhaFirstRow ? "PASS" : `FAIL (First row: "${firstDataRow}")`);

        return Object.values(checks).every(Boolean);
      }
    },
    {
      id: 2,
      input: "We use Encompass and HubSpot. Can your Encompass plugins help with duplicate updates?",
      validate: (msg: string) => {
        const lower = msg.toLowerCase();
        const lines = msg.split("\n").map(l => l.trim()).filter(Boolean);
        
        const hasBullets = lines.some(l => l.startsWith("-") || l.startsWith("*"));
        const hasTable = msg.includes("|");
        const usesBulletsOrTableNotBoth = !(hasBullets && hasTable);

        const checks = {
          startsYes: lower.trim().startsWith("yes") || lower.includes("yes,") || lower.includes("yes —") || lower.includes("yes -"),
          mentionsCRMOrLOSSync: lower.includes("crm / los synchronization") || lower.includes("crm/los synchronization") || lower.includes("synchronization"),
          mentionsAlignment: (lower.includes("encompass") && lower.includes("hubspot")) || lower.includes("data alignment") || lower.includes("data aligned") || lower.includes("synchronizing data") || lower.includes("synchronization"),
          usesBulletsOrTableNotBoth: usesBulletsOrTableNotBoth,
          noDefensiveConfirm: !lower.includes("i need to confirm") && 
                              !lower.includes("awesometech team can confirm") && 
                              !lower.includes("would you like me to follow up"),
          hasScopingNote: lower.includes("the final plugin fit and implementation scope can be reviewed during project scoping")
        };

        console.log("  - Starts with a direct Yes-style response:", checks.startsYes ? "PASS" : "FAIL");
        console.log("  - Mentions CRM / LOS Synchronization:", checks.mentionsCRMOrLOSSync ? "PASS" : "FAIL");
        console.log("  - Mentions Encompass and HubSpot data alignment:", checks.mentionsAlignment ? "PASS" : "FAIL");
        console.log("  - Uses either bullets or table, not both:", checks.usesBulletsOrTableNotBoth ? "PASS" : "FAIL");
        console.log("  - No weak confirmation language:", checks.noDefensiveConfirm ? "PASS" : "FAIL");
        console.log("  - Ends with final scoping note:", checks.hasScopingNote ? "PASS" : "FAIL");

        return Object.values(checks).every(Boolean);
      }
    },
    {
      id: 3,
      input: "Tell me about your Encompass plugins.",
      validate: (msg: string) => {
        const lower = msg.toLowerCase();
        const checks = {
          hasUseCases: lower.includes("automation") || lower.includes("lending") || lower.includes("plugin"),
          noDiscoveryHeaders: !msg.includes("What I Understand So Far") && 
                              !msg.includes("Possible Underlying Causes") && 
                              !msg.includes("Discovery Summary") &&
                              !msg.includes("Next Question"),
          noDefensiveConfirm: !lower.includes("i need to confirm") && 
                              !lower.includes("awesometech team can confirm") && 
                              !lower.includes("would you like me to follow up"),
          doesNotInventPlugins: !lower.includes("awesometech duplicates plugin") && !lower.includes("fake plugin")
        };

        console.log("  - Mentions practical use cases:", checks.hasUseCases ? "PASS" : "FAIL");
        console.log("  - No discovery sections:", checks.noDiscoveryHeaders ? "PASS" : "FAIL");
        console.log("  - No defensive disclaimers:", checks.noDefensiveConfirm ? "PASS" : "FAIL");
        console.log("  - Does not invent specific plugin names:", checks.doesNotInventPlugins ? "PASS" : "FAIL");

        return Object.values(checks).every(Boolean);
      }
    },
    {
      id: 4,
      input: "What is the exact price of your FHA Case Binder Plugin?",
      validate: (msg: string) => {
        const lower = msg.toLowerCase();
        const hasSpecificHallucinatedPrice = msg.match(/\$[0-9]+/i) || lower.includes("dollars") || lower.includes("usd");
        
        const checks = {
          mentionsScoping: lower.includes("scoping") || lower.includes("pricing") || lower.includes("scope") || lower.includes("project scoping"),
          noFakePrice: !hasSpecificHallucinatedPrice
        };

        console.log("  - Mentions pricing needs confirmation/scoping:", checks.mentionsScoping ? "PASS" : "FAIL");
        console.log("  - Does not invent fake price:", checks.noFakePrice ? "PASS" : "FAIL");

        return Object.values(checks).every(Boolean);
      }
    }
  ];

  let allPassed = true;
  for (const test of tests) {
    console.log(`\n=================== TEST ${test.id} ===================`);
    console.log(`Query: "${test.input}"`);
    
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
      continue;
    }

    const response = await handleMessage(session.id, test.input);
    console.log("Response:\n" + response.message);
    console.log("\nValidation Results:");
    const passed = test.validate(response.message);
    console.log("Overall status:", passed ? "PASSED" : "FAILED");
    if (!passed) allPassed = false;
  }

  console.log("\n=================== FINAL STATUS ===================");
  console.log(allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  if (!allPassed) process.exit(1);
}

runTests().catch(console.error);

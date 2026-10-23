import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function runQa() {
  const { handleMessage } = await import("../lib/chat/handleMessage");
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function createSession() {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        status: "collecting_core",
        completion_score: 0,
        missing_fields: []
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message}`);
    }
    return data.id;
  }

  const results: Array<{ test: string; status: string; notes: string; query: string; reply: string }> = [];

  console.log("=== STARTING FULL QA PROGRAMMATIC TESTING ===");

  // =================== TEST CATEGORY 1 ===================
  console.log("\n--- Category 1: Knowledge / Product Info Routing ---");

  // Test 1.1: Compare Encompass plugin use cases in a table
  try {
    const sid = await createSession();
    const query = "Can you compare your Encompass plugin use cases in a table?";
    console.log(`Running Test 1.1: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (!reply.startsWith("Based on the available context, here is a practical use-case category comparison:")) {
      passed = false;
      notes.push("Does not start with the required intro prefix.");
    }
    if (!reply.includes("|") || !reply.includes("Option") && !reply.includes("Use Case")) {
      passed = false;
      notes.push("Missing markdown table comparison.");
    }
    if (reply.includes("#")) {
      passed = false;
      notes.push("Contains markdown heading hashes (#).");
    }
    if (lower.includes("i need to confirm with the awesometech team") || lower.includes("would you like me to follow up")) {
      passed = false;
      notes.push("Contains weak confirmation/defensive language.");
    }
    if (!reply.includes("The final plugin fit and implementation scope can be reviewed during project scoping.")) {
      passed = false;
      notes.push("Missing scoping disclaimer at the end.");
    }

    results.push({
      test: "Test 1.1 (Encompass table compare)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 1.1 (Encompass table compare)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // Test 1.2: Tell me about your Encompass plugins
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "Tell me about your Encompass plugins.";
    console.log(`Running Test 1.2: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (reply.includes("What I Understand So Far") || reply.includes("Key Observations")) {
      passed = false;
      notes.push("Leaked into discovery mode.");
    }
    const hasCategories = ["workflow", "rule", "synchronization", "notification", "visibility"].some(cat => lower.includes(cat));
    if (!hasCategories) {
      passed = false;
      notes.push("Did not mention expected plugin categories.");
    }

    results.push({
      test: "Test 1.2 (Tell me about Encompass plugins)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 1.2 (Tell me about Encompass plugins)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // Test 1.3: Pricing query
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "What is the exact price of your FHA Case Binder Plugin?";
    console.log(`Running Test 1.3: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (lower.match(/\$\d+/) || lower.includes("price is $") || lower.includes("cost is $")) {
      passed = false;
      notes.push("Hallucinated price details.");
    }
    if (!lower.includes("scoping") && !lower.includes("quote") && !lower.includes("pricing depends")) {
      passed = false;
      notes.push("Did not explain custom scoping or pricing dependencies.");
    }

    results.push({
      test: "Test 1.3 (Pricing safety)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 1.3 (Pricing safety)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // =================== TEST CATEGORY 2 ===================
  console.log("\n--- Category 2: Contextual Knowledge Questions ---");

  // Test 2.1: Encompass + HubSpot duplicate updates
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "We use Encompass and HubSpot. Can your Encompass plugins help with duplicate updates?";
    console.log(`Running Test 2.1: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (!lower.startsWith("yes")) {
      passed = false;
      notes.push("Did not start with a direct Yes-style response.");
    }
    if (!lower.includes("hubspot") || !lower.includes("encompass")) {
      passed = false;
      notes.push("Did not mention user systems.");
    }
    if (!lower.includes("synchroniz") && !lower.includes("sync") && !lower.includes("alignment")) {
      passed = false;
      notes.push("Did not mention data synchronization or alignment.");
    }
    if (reply.includes("What I Understand So Far")) {
      passed = false;
      notes.push("Discovery structure leak.");
    }

    results.push({
      test: "Test 2.1 (HubSpot duplicate updates)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 2.1 (HubSpot duplicate updates)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // Test 2.2: Multi-turn Contextual Knowledge
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query1 = "We are using Encompass, HubSpot, and title/appraisal vendor systems. Our team manually updates loan statuses in multiple places.";
    console.log(`Running Test 2.2 Turn 1: "${query1}"`);
    await handleMessage(sid, query1);

    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const query2 = "Can your Encompass plugins help with this workflow?";
    console.log(`Running Test 2.2 Turn 2: "${query2}"`);
    const res = await handleMessage(sid, query2);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (!lower.includes("hubspot") && !lower.includes("encompass")) {
      passed = false;
      notes.push("Lost session systems context (HubSpot/Encompass).");
    }
    if (lower.includes("which systems do you use") || lower.includes("what systems are involved")) {
      passed = false;
      notes.push("Incorrectly repeated system questions.");
    }

    results.push({
      test: "Test 2.2 (Multi-turn Contextual Knowledge)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query: `${query1} -> ${query2}`,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 2.2 (Multi-turn Contextual Knowledge)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // =================== TEST CATEGORY 3 ===================
  console.log("\n--- Category 3: Project Onboarding / Discovery Flow ---");

  // Onboarding Chronological Turn Test (Tests 3.1 - 3.5)
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();

    // Turn 1
    const q1 = `We are a mortgage company using Encompass, HubSpot, and several vendor systems.
Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.
As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`;
    console.log(`Running Test 3.1: "${q1}"`);
    const res1 = await handleMessage(sid, q1);
    const r1 = res1.message;
    const l1 = r1.toLowerCase();

    let p1 = r1.includes("What I Understand So Far") && r1.includes("Key Observations") && r1.includes("Next Question");
    let np1 = !r1.includes("Recommended Approach") && !r1.includes("Phase 1") && !l1.includes("mismo") && !l1.includes("salesforce");
    results.push({
      test: "Test 3.1 (First Project Message)",
      status: (p1 && np1) ? "PASS" : "FAIL",
      notes: `Early discovery format: ${p1 ? "PASS" : "FAIL"}. No early recommendation: ${np1 ? "PASS" : "FAIL"}.`,
      query: q1,
      reply: r1
    });

    // Turn 2
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const q2 = `The biggest manual effort happens between application intake, processing, underwriting, and closing.
Processors manually update loan statuses in Encompass, update HubSpot records, notify borrowers, and follow up with title and appraisal vendors.
The same information often gets updated in multiple places, and different teams need visibility into the same loan status.`;
    console.log(`Running Test 3.2: "${q2}"`);
    const res2 = await handleMessage(sid, q2);
    const r2 = res2.message;
    const l2 = r2.toLowerCase();

    let p2 = r2.includes("Discovery Summary") && r2.includes("Solution Landscape") && r2.includes("|");
    let np2 = !r2.includes("Recommended Approach");
    results.push({
      test: "Test 3.2 (Workflow Details Follow-up)",
      status: (p2 && np2) ? "PASS" : "FAIL",
      notes: `Solution landscape format: ${p2 ? "PASS" : "FAIL"}. No final recommendation: ${np2 ? "PASS" : "FAIL"}.`,
      query: q2,
      reply: r2
    });

    // Turn 3
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const q3 = `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.
We process around 700 loans per month and expect volume to keep growing.`;
    console.log(`Running Test 3.3: "${q3}"`);
    const res3 = await handleMessage(sid, q3);
    const r3 = res3.message;
    const l3 = r3.toLowerCase();

    let p3 = r3.includes("Recommended Approach") && r3.includes("Evidence Supporting Recommendation");
    let np3 = (l3.includes("synchronization") || l3.includes("automation") || l3.includes("orchestration")) && !l3.includes("mismo") && !l3.includes("salesforce");
    results.push({
      test: "Test 3.3 (Goals and Volume)",
      status: (p3 && np3) ? "PASS" : "FAIL",
      notes: `High confidence format: ${p3 ? "PASS" : "FAIL"}. Concrete solution direction: ${np3 ? "PASS" : "FAIL"}.`,
      query: q3,
      reply: r3
    });

    // Turn 4
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const q4 = "This sounds aligned with what we need. What would be the next step if we want AwesomeTech to evaluate this properly and prepare a solution plan?";
    console.log(`Running Test 3.4: "${q4}"`);
    const res4 = await handleMessage(sid, q4);
    const r4 = res4.message;

    let p4 = r4.includes("Recommended Next Step") && r4.includes("Likely Solution Direction") && r4.includes("Information Needed to Prepare the Solution Plan");
    results.push({
      test: "Test 3.4 (Closing / Next Step)",
      status: p4 ? "PASS" : "FAIL",
      notes: `Next-step structure close: ${p4 ? "PASS" : "FAIL"}.`,
      query: q4,
      reply: r4
    });

    // Turn 5
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const q5 = "Sure. My name is John Carter, I’m the Operations Manager at ABC Mortgage. My email is john@abcmortgage.com. We’d like to review this within the next 2 weeks.";
    console.log(`Running Test 3.5: "${q5}"`);
    const res5 = await handleMessage(sid, q5);
    const r5 = res5.message;
    const l5 = r5.toLowerCase();

    let p5 = l5.includes("john carter") && l5.includes("abc mortgage") && l5.includes("john@abcmortgage.com") && l5.includes("2 weeks");
    let np5 = !l5.includes("what is your email") && !l5.includes("what is your name");
    results.push({
      test: "Test 3.5 (Contact Capture)",
      status: (p5 && np5) ? "PASS" : "FAIL",
      notes: `Lead summary accurate: ${p5 ? "PASS" : "FAIL"}. No repeated request: ${np5 ? "PASS" : "FAIL"}.`,
      query: q5,
      reply: r5
    });

  } catch (err: any) {
    console.error("Discovery Flow testing failed:", err);
  }

  // =================== TEST CATEGORY 5 ===================
  console.log("\n--- Category 5: Irrelevant / Out-of-Domain Queries ---");
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "Can you tell me about Marvel movies?";
    console.log(`Running Test 5.1: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;
    const lower = reply.toLowerCase();

    let passed = true;
    const notes: string[] = [];

    if (lower.includes("iron man") || lower.includes("spiderman") || lower.includes("avengers") || lower.includes("marvel cinematic universe")) {
      passed = false;
      notes.push("Answered the out-of-domain query.");
    }
    if (!lower.includes("unrelated") && !lower.includes("awesometech")) {
      passed = false;
      notes.push("Did not provide service-routing redirect.");
    }

    results.push({
      test: "Test 5.1 (Irrelevant query redirect)",
      status: passed ? "PASS" : "FAIL",
      notes: notes.join(" ") || "All assertions passed.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 5.1 (Irrelevant query redirect)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // =================== TEST CATEGORY 6 ===================
  console.log("\n--- Category 6: Language Behavior ---");

  // Test 6.1: English query -> English response
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "Can you explain your AI automation services?";
    console.log(`Running Test 6.1: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;

    const hasUrdu = reply.toLowerCase().includes("aap") || reply.toLowerCase().includes("hai");
    results.push({
      test: "Test 6.1 (English language query)",
      status: !hasUrdu ? "PASS" : "FAIL",
      notes: hasUrdu ? "Responded with Roman Urdu elements." : "English response verified.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 6.1 (English language query)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  // Test 6.2: Roman Urdu query -> Roman Urdu response
  try {
    console.log("Sleeping 65s to avoid Groq rate limits...");
    await sleep(65000);
    const sid = await createSession();
    const query = "Aap mujhy apni AI automation services explain kar skty ho?";
    console.log(`Running Test 6.2: "${query}"`);
    const res = await handleMessage(sid, query);
    const reply = res.message;

    const hasUrdu = reply.toLowerCase().includes("aap") || reply.toLowerCase().includes("hai") || reply.toLowerCase().includes("kar") || reply.toLowerCase().includes("sakte");
    results.push({
      test: "Test 6.2 (Roman Urdu language query)",
      status: hasUrdu ? "PASS" : "FAIL",
      notes: !hasUrdu ? "Failed to respond in Roman Urdu." : "Roman Urdu response verified.",
      query,
      reply
    });
  } catch (err: any) {
    results.push({
      test: "Test 6.2 (Roman Urdu language query)",
      status: "FAIL",
      notes: err.message,
      query: "",
      reply: ""
    });
  }

  console.log("\n=== QA RUN COMPLETED ===");
  console.log("----------------------------------------");
  for (const r of results) {
    console.log(`[${r.status}] ${r.test} - Notes: ${r.notes}`);
  }
}

runQa().catch(console.error);

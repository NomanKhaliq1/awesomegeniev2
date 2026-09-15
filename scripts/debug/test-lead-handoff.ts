import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");

  console.log("Starting a fresh session for lead handoff testing...");
  const session = await startSession();
  const sessionId = session.id;
  console.log(`Session started: ${sessionId}`);

  const turns = [
    "I'd like to discuss a custom Encompass and HubSpot integration project.",
    "Yes, we need to synchronize loan status updates from Encompass to HubSpot so our sales team has real-time visibility. Currently, operations teams manually update HubSpot, which leads to duplicate data entry and delayed communications.",
    `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across processing, underwriting, and closing teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.
We process around 700 loans per month and expect the volume to keep growing.`,
    "What would be the next step if we want AwesomeTech to evaluate this properly and prepare a solution plan?",
    "My name is John Carter, I'm the Operations Manager at ABC Mortgage. My email is john@abcmortgage.com. We'd like to review this within the next 2 weeks.",
    `We will share the workflow document from our side. It includes current loan status update process, HubSpot update points, borrower notification triggers, title and appraisal vendor follow-up steps, duplicated fields between Encompass and HubSpot, and manual handoff points. Should we upload it here now so AwesomeTech can review it before the discovery session?`,
    "generate the official project brief now"
  ];

  for (let i = 0; i < turns.length; i++) {
    console.log(`\n--- Turn ${i + 1} ---`);
    console.log(`User: ${turns[i]}`);
    const res = await handleMessage(sessionId, turns[i]);
    console.log(`Assistant:\n${res.message.substring(0, 300)}...`);
  }

  // Now, test the lead handoff behavior
  console.log("\n--- Turn 8 (Acceptance Test Case - Lead Handoff) ---");
  const handoffMessage = `This updated brief looks good.

Please consider this ready for AwesomeTech’s sales and implementation teams. ABC Mortgage is available for a workflow scoping session next week on Tuesday or Thursday afternoon.

Please confirm the next step and prepare the lead handoff package with the project brief, workflow document, sales handoff summary, implementation notes, and chat transcript.`;

  console.log(`User: ${handoffMessage}`);
  const finalRes = await handleMessage(sessionId, handoffMessage);
  console.log(`\nAssistant Response:\n${finalRes.message}`);

  // Let's verify the response matches all rules
  const msg = finalRes.message;
  const passedChecks = {
    doesNotRepeatBrief: !msg.includes("Official Project Brief") && !msg.includes("Contact and Company Details") && !msg.includes("Current Workflow Problem"),
    acknowledgesBriefReady: /ready/i.test(msg) || /brief is ready/i.test(msg),
    acknowledgesAvailability: /Tuesday or Thursday/i.test(msg),
    uploadedToDriveSuccessfully: msg.includes("I’ve prepared the lead handoff package") && msg.includes("Lead ID") && msg.includes("Drive folder link"),
    listsManualPackageContents: msg.includes("project brief") && msg.includes("workflow document") && msg.includes("sales handoff summary") && msg.includes("implementation notes") && msg.includes("chat transcript"),
    hasNextStep: /next step/i.test(msg) || /Next step/i.test(msg),
    doesNotSayMeetingIsBooked: !msg.includes("meeting is booked") && !msg.includes("session is booked")
  };

  console.log("\n--- Verification Results ---");
  console.log(JSON.stringify(passedChecks, null, 2));
}

main().catch(console.error);

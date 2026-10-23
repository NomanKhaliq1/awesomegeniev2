import assert from "node:assert/strict";
import {
  routeMessageFallback,
  shouldGenerateProjectBriefNow,
  wantsProjectBriefGeneration
} from "@/lib/agents/routerAgent";
import { composeProjectBriefResponse } from "@/lib/brief/composeProjectBriefResponse";

const generationRequests = [
  "Project brief",
  "Please generate the official project brief now using what we already shared.",
  "Create a project summary from the details already collected.",
  "Ab project brief bana do, aur koi question mat poochna.",
  "Brief tayyar kar do based on details already shared."
];

for (const message of generationRequests) {
  assert.equal(wantsProjectBriefGeneration(message), true, `Expected brief intent: ${message}`);
  assert.equal(
    routeMessageFallback(message).intent,
    "project_brief_generation",
    `Expected deterministic brief route: ${message}`
  );
  assert.equal(
    shouldGenerateProjectBriefNow({ message, activeProjectContext: true }),
    true,
    `Expected immediate generation: ${message}`
  );
}

const nonGenerationRequests = [
  "Update the project brief timeline.",
  "The project brief looks good, consider this ready for sales.",
  "Prepare the lead handoff package and save the brief."
];

for (const message of nonGenerationRequests) {
  assert.equal(
    shouldGenerateProjectBriefNow({ message, activeProjectContext: true }),
    false,
    `Expected revision/approval/handoff to avoid generation branch: ${message}`
  );
}

assert.equal(
  shouldGenerateProjectBriefNow({ message: "Project brief", activeProjectContext: false }),
  false,
  "A bare brief request without any active project context should not fabricate a project."
);

const partialBrief = composeProjectBriefResponse({
  userMessage: "Generate the project brief now.",
  collectedMemory: {
    business_problem: "The team manually updates the same status in multiple systems.",
    existing_systems: "CRM and spreadsheets"
  },
  recentConversation:
    "user: We need to reduce duplicate updates and improve visibility.\nassistant: Which teams are involved?\nuser: Sales and operations."
});

assert.match(partialBrief, /Official Project Brief/i);
assert.match(partialBrief, /Not confirmed yet/i);
assert.doesNotMatch(partialBrief, /\?\s*$/);

console.log("Project brief routing smoke passed.");

import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";
import { isGoogleDriveConfigured } from "@/lib/drive/googleDriveClient";
import { handoffBriefToDrive } from "@/lib/drive/handoffToDrive";
import { generateProjectBrief } from "@/lib/brief/generateProjectBrief";
import { detectUserLanguage } from "./languageDetection";

export function composeBriefApprovedNextStepResponse({
  userMessage,
  collectedMemory,
  recentConversation,
  conversationSummary,
}: {
  userMessage: string;
  collectedMemory: RequirementMemory;
  recentConversation?: string;
  conversationSummary?: string;
}) {
  const targetLanguage = detectUserLanguage(userMessage);

  // Extract company name: check collectedMemory first, else check recentConversation / userMessage, default to "the client"
  let companyName = (collectedMemory?.company_name as string) || "";
  if (!companyName) {
    const text = `${conversationSummary || ""} ${recentConversation || ""} ${userMessage}`.toLowerCase();
    const match = text.match(/company\s+(?:is|name is|name)\s+([A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/i);
    if (match) {
      companyName = match[1].trim();
    } else {
      companyName = "the client";
    }
  }

  // Ensure first letters are capitalized nicely
  if (companyName && companyName !== "the client") {
    companyName = companyName.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Extract availability from userMessage or recentConversation
  let availability = "";
  const fullText = `${userMessage} ${recentConversation || ""}`;
  const nextWeekMatch =
    fullText.match(/\b(next week on [A-Za-z]+(?:\s+or\s+[A-Za-z]+)?(?:\s+(?:afternoon|morning|evening|night))?)\b/i) ||
    fullText.match(/\b(available (?:next week )?(?:on )?[A-Za-z]+(?:\s+or\s+[A-Za-z]+)?(?:\s+(?:afternoon|morning|evening|night))?)\b/i);

  if (nextWeekMatch) {
    availability = nextWeekMatch[1].trim();
  } else {
    const days = [];
    const lowerText = fullText.toLowerCase();
    if (lowerText.includes("monday")) days.push("Monday");
    if (lowerText.includes("tuesday")) days.push("Tuesday");
    if (lowerText.includes("wednesday")) days.push("Wednesday");
    if (lowerText.includes("thursday")) days.push("Thursday");
    if (lowerText.includes("friday")) days.push("Friday");

    let timeOfDay = "";
    if (lowerText.includes("afternoon")) timeOfDay = " afternoon";
    else if (lowerText.includes("morning")) timeOfDay = " morning";
    else if (lowerText.includes("evening")) timeOfDay = " evening";

    if (days.length > 0) {
      const dayStr =
        days.length === 1 ? days[0] : days.slice(0, -1).join(", ") + " or " + days[days.length - 1];
      const weekPrefix = lowerText.includes("next week") ? "next week on " : "on ";
      availability = `${weekPrefix}${dayStr}${timeOfDay}`;
    }
  }

  if (!availability && /\bstart discovery within (?:the )?next two weeks\b|\bwithin (?:the )?next two weeks\b/i.test(fullText)) {
    availability = "within the next two weeks";
  }

  // If user says Roman Urdu, return Roman Urdu
  if (targetLanguage === "roman_urdu") {
    const romanUrduCompany = companyName === "the client" ? "client" : companyName;

    let romanUrduAvailability = availability;
    if (availability.toLowerCase().includes("next week on tuesday or thursday afternoon")) {
      romanUrduAvailability = "aglay hafte Tuesday ya Thursday afternoon ko";
    } else {
      romanUrduAvailability = romanUrduAvailability
        .replace(/next week/i, "aglay hafte")
        .replace(/on /i, "")
        .replace(/monday/i, "Monday")
        .replace(/tuesday/i, "Tuesday")
        .replace(/wednesday/i, "Wednesday")
        .replace(/thursday/i, "Thursday")
        .replace(/friday/i, "Friday")
        .replace(/afternoon/i, "afternoon")
        .replace(/morning/i, "morning")
        .replace(/evening/i, "evening")
        .replace(/ or /i, " ya ");

      if (!romanUrduAvailability.includes("ko")) {
        romanUrduAvailability += " ko";
      }
    }

    return [
      `Bohat acha, project brief AwesomeTech ki sales aur implementation teams ke liye tayar hai.`,
      ``,
      `Next Step`,
      ``,
      `Agla qadam workflow scoping session schedule karna hai. ${romanUrduCompany} ${romanUrduAvailability} available hai, is liye AwesomeTech ko confirm karna chahiye ke konsa slot sab se behtar rahe ga.`,
      ``,
      `What to Prepare Before the Session`,
      ``,
      `* workflow document ya process maps`,
      `* involved systems ke sample data fields aur milestones`,
      `* integration APIs aur CRM/database details`,
      `* customer aur vendor notification triggers`,
      `* departments ya teams ke darmiyan maujuda manual handoff points`,
      `* maujuda reporting ya visibility gaps`,
      `* security, compliance, aur access requirements`,
      ``,
      `Session Goal`,
      ``,
      `Is session ka maqsad pehli phase ke scope ko validate karna, system touchpoints ko confirm karna, aur data synchronization, workflow automation, notifications, aur vendor coordination support ke mutaliq ek solution plan tayar karna hai.`
    ].join("\n");
  }

  const nextStep =
    availability
      ? `The next step is to schedule the workflow scoping session. ${companyName} is available ${availability}, so AwesomeTech should confirm which slot works best.`
      : `The next step is to schedule the workflow scoping session. Our team should follow up with the primary contact to confirm the best time.`;

  // English
  return [
    `Great, the project brief is ready for AwesomeTech’s sales and implementation teams.`,
    ``,
    `Next Step`,
    ``,
    nextStep,
    ``,
    `What to Prepare Before the Session`,
    ``,
    `* workflow document or process maps`,
    `* sample data fields and milestones of the systems involved`,
    `* integration APIs and CRM/database access details`,
    `* customer and vendor notification triggers`,
    `* current manual handoff points between departments or teams`,
    `* current reporting or visibility gaps`,
    `* security, compliance, and access requirements`,
    ``,
    `Session Goal`,
    ``,
    `The goal of the session is to validate the first-phase scope, confirm system touchpoints, and prepare a solution plan around data synchronization, workflow automation, notifications, and vendor coordination support.`
  ].join("\n");
}

export async function composeLeadHandoffPackageResponse({
  sessionId,
  userMessage,
  collectedMemory,
  recentConversation,
  conversationSummary
}: {
  sessionId?: string;
  userMessage: string;
  collectedMemory: RequirementMemory;
  recentConversation?: string;
  conversationSummary?: string;
  uploadedDocuments?: any;
  projectBrief?: any;
}) {
  const targetLanguage = detectUserLanguage(userMessage);

  let availability = "";
  const fullText = `${userMessage} ${recentConversation || ""}`;
  const nextWeekMatch =
    fullText.match(/\b(next week on [A-Za-z]+(?:\s+or\s+[A-Za-z]+)?(?:\s+(?:afternoon|morning|evening|night))?)\b/i) ||
    fullText.match(/\b(available (?:next week )?(?:on )?[A-Za-z]+(?:\s+or\s+[A-Za-z]+)?(?:\s+(?:afternoon|morning|evening|night))?)\b/i);

  if (nextWeekMatch) {
    availability = nextWeekMatch[1].trim();
  } else {
    const days = [];
    const lowerText = fullText.toLowerCase();
    if (lowerText.includes("monday")) days.push("Monday");
    if (lowerText.includes("tuesday")) days.push("Tuesday");
    if (lowerText.includes("wednesday")) days.push("Wednesday");
    if (lowerText.includes("thursday")) days.push("Thursday");
    if (lowerText.includes("friday")) days.push("Friday");

    let timeOfDay = "";
    if (lowerText.includes("afternoon")) timeOfDay = " afternoon";
    else if (lowerText.includes("morning")) timeOfDay = " morning";
    else if (lowerText.includes("evening")) timeOfDay = " evening";

    if (days.length > 0) {
      const dayStr =
        days.length === 1 ? days[0] : days.slice(0, -1).join(", ") + " or " + days[days.length - 1];
      const weekPrefix = lowerText.includes("next week") ? "next week on " : "on ";
      availability = `${weekPrefix}${dayStr}${timeOfDay}`;
    }
  }

  if (!availability && /\bstart discovery within (?:the )?next two weeks\b|\bwithin (?:the )?next two weeks\b/i.test(fullText)) {
    availability = "within the next two weeks";
  }

  let companyName = (collectedMemory?.company_name as string) || "";
  if (!companyName) {
    const text = `${conversationSummary || ""} ${recentConversation || ""} ${userMessage}`.toLowerCase();
    const match = text.match(/company\s+(?:is|name is|name)\s+([A-Za-z0-9 &.'-]{2,80}?)(?:\.|,|\n|$)/i);
    if (match) {
      companyName = match[1].trim();
    } else {
      companyName = "the client";
    }
  }

  if (companyName && companyName !== "the client") {
    companyName = companyName.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Check if Drive is configured and we can run it
  let driveResult = null;
  if (isGoogleDriveConfigured() && sessionId) {
    try {
      const supabase = createOptionalSupabaseServiceClient();
      let latestBrief = null;
      if (supabase) {
        const { data } = await supabase
          .from("project_briefs")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latestBrief = data;
      }

      let briefToUpload = null;
      if (latestBrief) {
        briefToUpload = {
          id: latestBrief.id,
          title: latestBrief.title,
          contentMarkdown: latestBrief.content_markdown
        };
      } else {
        briefToUpload = await generateProjectBrief(sessionId);
      }

      if (briefToUpload) {
        driveResult = await handoffBriefToDrive({
          sessionId,
          brief: briefToUpload
        });
      }
    } catch (e) {
      console.error("Google Drive handoff failed in composer:", e);
    }
  }

  const contactName = String(collectedMemory.contact_name || "the primary contact");
  const timeline = String(collectedMemory.timeline || "").trim();

  if (targetLanguage === "roman_urdu") {
    return [
      "Theek hai, corrected project brief hamari sales aur implementation teams ke review ke liye tayar hai.",
      "",
      `Hamari team details review kar ke ${contactName} se scoping session coordinate karne ke liye follow up kare gi${timeline ? `, aur confirmed timeline yeh hai: ${timeline}.` : "."}`,
      "",
      "Session se pehle available workflow documents, process maps, sample status fields, borrower notification rules, current handoff points, reporting gaps, aur security ya access requirements share karna madadgar hoga.",
      "",
      "Aap filhal all set hain. Agar koi detail change ho to yahan share kar dein aur hum project notes update kar dein ge."
    ].join("\n");
  }

  return [
    "Great, the corrected project brief is ready for our sales and implementation teams.",
    "",
    `Our team will review the brief and workflow details and follow up with ${contactName} to coordinate the scoping session${timeline ? `, using the confirmed timeline: ${timeline}.` : "."}`,
    "",
    "Before the session, it would be helpful to share any available workflow documents, process maps, sample status fields, borrower notification rules, current handoff points, reporting gaps, and security or access requirements.",
    "",
    "You are all set for now. If anything changes, share it here and we will include it with the project notes."
  ].join("\n");

  const isUploaded = driveResult?.status === "uploaded";
  const leadId = sessionId ? `ABC-${(sessionId ?? "").slice(0, 8).toUpperCase()}` : "ABC-HANDOFF";
  const folderLink = (isUploaded && driveResult && "folderId" in driveResult) ? `https://drive.google.com/drive/folders/${driveResult.folderId}` : null;

  const adminPatterns = [
    /show me the drive link/i,
    /what is the lead id/i,
    /did the backend create the lead/i,
    /check handoff logs/i,
    /admin view/i,
    /\bqa\b/i,
    /\btest\b/i,
    /\bdrive folder\b/i,
    /\blead record\b/i,
    /\benvironment\b/i,
    /backend status/i,
    /where was this saved/i
  ];
  const isAdmin = adminPatterns.some((pattern) => pattern.test(userMessage));

  let cleanAvailability = availability.trim();
  cleanAvailability = cleanAvailability.replace(/^available\s+/i, "");
  if (!cleanAvailability) {
    cleanAvailability = "";
  } else if (cleanAvailability.toLowerCase().includes("within the next two weeks")) {
    cleanAvailability = "within the next two weeks";
  } else if (!cleanAvailability.toLowerCase().includes("next week")) {
    cleanAvailability = "next week on " + cleanAvailability.replace(/^on\s+/i, "");
  } else if (!cleanAvailability.toLowerCase().includes("next week on")) {
    cleanAvailability = cleanAvailability.replace(/next week\s+/i, "next week on ");
  }

  if (!isAdmin) {
    if (targetLanguage === "roman_urdu") {
      const romanUrduCompany = companyName === "the client" ? "client" : companyName;

      let romanUrduAvailability = cleanAvailability;
      romanUrduAvailability = romanUrduAvailability
        .replace(/next week on/i, "")
        .replace(/next week/i, "")
        .replace(/on /i, "")
        .replace(/monday/i, "Monday")
        .replace(/tuesday/i, "Tuesday")
        .replace(/wednesday/i, "Wednesday")
        .replace(/thursday/i, "Thursday")
        .replace(/friday/i, "Friday")
        .replace(/afternoon/i, "afternoon")
        .replace(/morning/i, "morning")
        .replace(/evening/i, "evening")
        .replace(/ or /i, " ya ")
        .trim();

      const romanUrduNextStep = romanUrduAvailability
        ? `Hum scoping session se pehle project brief aur workflow details ko review karenge. Kyunki aapki team ${romanUrduAvailability} ke liye available hai, toh humari team confirm karegi ke konsa slot sabse behtar hai.`
        : `Hum scoping session se pehle project brief aur workflow details ko review karenge. Humari team primary contact ke sath best time confirm karegi.`;

      return [
        `Great, project brief humari sales aur implementation teams ke liye tayar hai.`,
        ``,
        `Next Step`,
        ``,
        romanUrduNextStep,
        ``,
        `What to Prepare Before the Session`,
        ``,
        `* workflow document ya process maps`,
        `* involved systems ke sample data fields aur milestones`,
        `* integration APIs aur CRM/database details`,
        `* customer aur vendor notification triggers`,
        `* maujuda manual handoff points aur bottlenecks`,
        `* maujuda reporting ya visibility gaps`,
        `* security, compliance, aur access requirements`,
        ``,
        `Aap abhi ke liye bilkul tayar hain. Agar session se pehle koi tabdeeli hoti hai, toh aap use yahan share kar sakte hain aur hum use project notes ke sath shamil kar denge.`
      ].join("\n");
    }

    const englishNextStep = cleanAvailability
      ? `We'll review the project brief and workflow details before the workflow scoping session. Since your team is available ${cleanAvailability}, our team will confirm which slot works best.`
      : `We'll review the project brief and workflow details before the workflow scoping session. Our team will follow up with the primary contact to confirm the best time.`;

    return [
      `Great, the project brief is ready for our sales and implementation teams.`,
      ``,
      `Next Step`,
      ``,
      englishNextStep,
      ``,
      `What to Prepare Before the Session`,
      ``,
      `* workflow document or process maps`,
      `* sample data fields and milestones of the systems involved`,
      `* integration APIs and CRM/database access details`,
      `* customer and vendor notification triggers`,
      `* current manual handoff points and bottlenecks`,
      `* current reporting or visibility gaps`,
      `* security, compliance, and access requirements`,
      ``,
      `You’re all set for now. If anything changes before the session, you can share it here and we’ll include it with the project notes.`
    ].join("\n");
  }

  // Admin / Testing mode output
  if (targetLanguage === "roman_urdu") {
    const romanUrduCompany = companyName === "the client" ? "client" : companyName;

    let romanUrduAvailability = cleanAvailability;
    romanUrduAvailability = romanUrduAvailability
      .replace(/next week on/i, "")
      .replace(/next week/i, "")
      .replace(/on /i, "")
      .replace(/monday/i, "Monday")
      .replace(/tuesday/i, "Tuesday")
      .replace(/wednesday/i, "Wednesday")
      .replace(/thursday/i, "Thursday")
      .replace(/friday/i, "Friday")
      .replace(/afternoon/i, "afternoon")
      .replace(/morning/i, "morning")
      .replace(/evening/i, "evening")
      .replace(/ or /i, " ya ")
      .trim();

    if (isUploaded && folderLink) {
      return [
        `Project brief humari sales aur implementation teams ke liye tayar hai.`,
        ``,
        `Mein ne lead handoff package tayar kar diya hai jis mein yeh shamil hai:`,
        ``,
        `* project brief`,
        `* workflow document`,
        `* sales handoff summary`,
        `* implementation notes`,
        `* chat transcript`,
        ``,
        `Next step: Humey next week ${romanUrduAvailability} ke liye ${romanUrduCompany} ke sath workflow scoping session ka time confirm karna chahiye.`,
        ``,
        `Lead ID: ${leadId}`,
        `Drive folder link: ${folderLink}`
      ].join("\n");
    }

    return [
      `Project brief humari sales aur implementation teams ke liye tayar hai, lekin automatic lead/Drive handoff creation abhi is environment mein available nahi hai.`,
      ``,
      `Team ko manually handoff package tayar karna chahiye jis mein yeh cheezein hon:`,
      ``,
      `* project brief`,
      `* workflow document`,
      `* sales handoff summary`,
      `* implementation notes`,
      `* chat transcript`,
      ``,
      `Next step: Humey next week ${romanUrduAvailability} ke liye ${romanUrduCompany} ke sath workflow scoping session ka time confirm karna chahiye.`
    ].join("\n");
  }

  if (isUploaded && folderLink) {
    return [
      `The project brief is ready for our sales and implementation teams.`,
      ``,
      `I’ve prepared the lead handoff package with:`,
      ``,
      `* project brief`,
      `* workflow document`,
      `* sales handoff summary`,
      `* implementation notes`,
      `* chat transcript`,
      ``,
      `Next step: We should confirm the workflow scoping session time with ${companyName} for ${cleanAvailability.replace("next week on ", "")}.`,
      ``,
      `Lead ID: ${leadId}`,
      `Drive folder link: ${folderLink}`
    ].join("\n");
  }

  return [
    `The project brief is ready for our sales and implementation teams, but automatic lead/Drive handoff creation is not currently available in this environment.`,
    ``,
    `The team should manually create the handoff package with:`,
    ``,
    `* project brief`,
    `* workflow document`,
    `* sales handoff summary`,
    `* implementation notes`,
    `* chat transcript`,
    ``,
    `Next step: We should confirm the workflow scoping session time with ${companyName} for ${cleanAvailability.replace("next week on ", "")}.`
  ].join("\n");

}

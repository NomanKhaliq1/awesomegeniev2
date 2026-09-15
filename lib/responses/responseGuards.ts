import type { RequirementMemory } from "@/lib/data/requirementsRepository";
import { textContainsRejectedFact } from "@/lib/onboarding/conversationControl";
import { evaluateConversationState } from "@/lib/onboarding/conversationStateManager";
import { detectUserLanguage } from "./languageDetection";

function clean(text: string): string {
  return text.toLowerCase().replace(/[^\w]/g, "");
}

function extractQuestionFromText(text: string): string | null {
  const lines = text.split("\n");

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();

    if (line.toLowerCase().startsWith("next question:")) {
      return line.slice("next question:".length).trim();
    }

    if (line.toLowerCase().startsWith("next question")) {
      return line.slice("next question".length).trim();
    }
  }

  const matches = text.match(/[^.!?]*\?/g);

  if (matches && matches.length > 0) {
    return matches[matches.length - 1].trim();
  }

  return null;
}

export function enforceSpecificSystems(response: string, userMessage: string): string {
  let cleaned = response;
  const userLower = userMessage.toLowerCase();
  const targetLanguage = detectUserLanguage(userMessage);
  const isRomanUrdu = targetLanguage === "roman_urdu";
  
  if (userLower.includes("hubspot") && !cleaned.toLowerCase().includes("hubspot")) {
    if (cleaned.toLowerCase().includes("encompass")) {
      if (isRomanUrdu) {
        cleaned = cleaned.replace(/\bEncompass\s+plugins\b/gi, "Encompass aur HubSpot integration plugins");
        cleaned = cleaned.replace(/\bEncompass\s+plugin\b/gi, "Encompass aur HubSpot plugin");
        cleaned = cleaned.replace(/\byour\s+systems\b/gi, "Encompass aur HubSpot");
      } else {
        cleaned = cleaned.replace(/\bEncompass\s+plugins\b/gi, "Encompass and HubSpot integration plugins");
        cleaned = cleaned.replace(/\bEncompass\s+plugin\b/gi, "Encompass and HubSpot plugin");
        cleaned = cleaned.replace(/\byour\s+systems\b/gi, "Encompass and HubSpot");
      }
    } else {
      if (isRomanUrdu) {
        cleaned = cleaned + " Yeh integration Encompass aur HubSpot dono ke liye hai.";
      } else {
        cleaned = cleaned + " This integration applies to both Encompass and HubSpot.";
      }
    }
  }
  
  if (userLower.includes("encompass") && !cleaned.toLowerCase().includes("encompass")) {
    if (isRomanUrdu) {
      cleaned = cleaned + " Yeh seedha aapke Encompass system ke sath kaam karta hai.";
    } else {
      cleaned = cleaned + " This works directly with your Encompass system.";
    }
  }
  
  return cleaned;
}

export function enforceContextualMemory(response: string, userMessage: string, recentConversation: string): string {
  let cleaned = response;
  const historyLower = recentConversation.toLowerCase();
  const respLower = cleaned.toLowerCase();
  const targetLanguage = detectUserLanguage(userMessage);
  const isRomanUrdu = targetLanguage === "roman_urdu";

  if (historyLower.includes("hubspot") && !respLower.includes("hubspot") && !respLower.includes("crm")) {
    if (cleaned.toLowerCase().includes("crm")) {
      cleaned = cleaned.replace(/\bCRM\b/g, "HubSpot CRM");
    } else {
      if (isRomanUrdu) {
        cleaned = cleaned.replace(/\bdusray\s+systems\b/gi, "dusray systems jaise HubSpot CRM");
        cleaned = cleaned.replace(/\bdoosre\s+systems\b/gi, "doosre systems jaise HubSpot CRM");
        cleaned = cleaned.replace(/\bother\s+systems\b/gi, "dusray systems jaise HubSpot CRM");
        if (!cleaned.toLowerCase().includes("hubspot")) {
          cleaned = cleaned + " Yeh HubSpot CRM ke sath kaam karta hai.";
        }
      } else {
        cleaned = cleaned.replace(/\bother\s+systems\b/gi, "other systems like HubSpot CRM");
      }
    }
  }

  const hasVendorContext = historyLower.includes("vendor") || historyLower.includes("title") || historyLower.includes("appraisal");
  const respHasVendor = respLower.includes("vendor") || respLower.includes("title") || respLower.includes("appraisal");
  
  if (hasVendorContext && !respHasVendor) {
    if (cleaned.includes("such as CRM and document management tools")) {
      cleaned = cleaned.replace("such as CRM and document management tools", isRomanUrdu ? "jaise HubSpot CRM aur title/appraisal vendor systems" : "such as HubSpot CRM and title/appraisal vendor systems");
    } else if (cleaned.toLowerCase().includes("other systems")) {
      cleaned = cleaned.replace(/other\s+systems/gi, isRomanUrdu ? "dusray systems, jinme title aur appraisal vendors shamil hain" : "other systems, including title and appraisal vendors");
    } else {
      if (isRomanUrdu) {
        cleaned = cleaned + " Isme aapke title aur appraisal vendor systems ke sath integrations bhi shamil hain.";
      } else {
        cleaned = cleaned + " This also includes integrations with your title and appraisal vendor systems.";
      }
    }
  }

  return cleaned;
}

export function enforceConsultantContext(
  response: string,
  userMessage: string,
  recentConversation: string,
  collectedMemory: RequirementMemory
): string {
  let cleaned = response;
  const userLower = userMessage.toLowerCase();
  const historyLower = (recentConversation || "").toLowerCase();
  const respLower = cleaned.toLowerCase();

  const hasEncompass = historyLower.includes("encompass") || (typeof collectedMemory.existing_systems === "string" && collectedMemory.existing_systems.toLowerCase().includes("encompass"));
  const hasHubSpot = historyLower.includes("hubspot") || (typeof collectedMemory.existing_systems === "string" && collectedMemory.existing_systems.toLowerCase().includes("hubspot"));

  if (hasEncompass && !respLower.includes("encompass")) {
    if (cleaned.toLowerCase().includes("multiple systems")) {
      cleaned = cleaned.replace(/multiple\s+systems/gi, "systems like Encompass");
    } else if (cleaned.toLowerCase().includes("your systems")) {
      cleaned = cleaned.replace(/your\s+systems/gi, "Encompass");
    }
  }

  if (hasHubSpot && !respLower.includes("hubspot")) {
    if (cleaned.toLowerCase().includes("crm")) {
      cleaned = cleaned.replace(/\bcrm\b/gi, "HubSpot");
    }
  }

  const hasVendor = userLower.includes("vendor") || userLower.includes("title") || userLower.includes("appraisal") || historyLower.includes("vendor");
  const hasBorrower = userLower.includes("borrower") || userLower.includes("customer") || historyLower.includes("borrower");
  const hasVisibility = userLower.includes("visibility") || historyLower.includes("visibility");

  if (hasVendor && !respLower.includes("vendor") && !respLower.includes("title") && !respLower.includes("appraisal")) {
    cleaned = cleaned.replace(/manual\s+work/gi, "manual work and vendor coordination");
    cleaned = cleaned.replace(/manual\s+coordination/gi, "manual vendor coordination");
  }

  if (hasBorrower && !respLower.includes("borrower")) {
    cleaned = cleaned.replace(/communication/gi, "borrower communication");
  }

  if (hasVisibility && !respLower.includes("visibility")) {
    cleaned = cleaned.replace(/visibility/gi, "team visibility");
    if (!cleaned.toLowerCase().includes("visibility")) {
      cleaned = cleaned.replace("scaling efficiently", "scaling efficiently and improving visibility across teams");
    }
  }

  if ((userLower.includes("workflow") || historyLower.includes("workflow")) && !respLower.includes("workflow")) {
    cleaned = cleaned.replace(/\bprocess\b/gi, "workflow");
  }

  return cleaned;
}

export function enforceNextQuestion(response: string, nextQuestion: string | null): string {
  if (!nextQuestion) return response;

  if (/does (?:that|this) assessment sound accurate\?/i.test(nextQuestion)) {
    return removeDuplicateSentences(nextQuestion.trim());
  }

  if (
    isGenericCurrentProcessQuestion(nextQuestion) &&
    /\b(?:already|you(?:'ve| have))\s+(?:walked|explained|described|shared|told)\b/i.test(response)
  ) {
    return removeDuplicateSentences(removeQuestionClauses(response));
  }

  const observation = removeQuestionClauses(response);
  const combined = observation ? `${observation}\n\n${nextQuestion.trim()}` : nextQuestion.trim();
  return removeDuplicateSentences(combined);
}

export function enforceNoUnsupportedDiscoveryClaims(
  response: string,
  userMessage: string,
  recentConversation: string
) {
  const evidence = `${userMessage}\n${recentConversation}`.toLowerCase();
  const hasErrorEvidence = /\b(error|errors|mistake|mistakes|incorrect|inaccurate|accuracy issue)\b/i.test(evidence);

  if (hasErrorEvidence) return response;

  return response
    .replace(/[^.!?]*(?:prone to errors|error-prone|likely to (?:cause|create) errors)[^.!?]*[.!?]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeQuestionClauses(response: string) {
  return response
    .replace(/[^.!?\n]*\?/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeDuplicateSentences(response: string) {
  const sentences = response.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [response];
  const seen = new Set<string>();
  const unique = sentences.filter((sentence) => {
    const normalized = clean(sentence);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return unique
    .map((sentence) => sentence.trim())
    .join(" ")
    .replace(/\s+([.!?])/g, "$1")
    .trim();
}

export function enforceNoUnsupportedProcessQuestion(
  response: string,
  userMessage: string,
  recentConversation: string,
  nextQuestion: string | null
): string {
  if (!nextQuestion || !isGenericCurrentProcessQuestion(nextQuestion)) {
    return response;
  }

  const lastQuestion = extractQuestionFromText(response);
  if (!lastQuestion) {
    return response;
  }

  const evidence = `${userMessage}\n${recentConversation}`.toLowerCase();
  const unsupportedTerms = [
    "customer support",
    "support team",
    "support request",
    "status update",
    "status updates",
    "progress check",
    "progress checks",
    "operations team",
    "operations",
    "sales team",
    "processing team",
    "underwriting",
    "closing",
    "borrower",
    "loan",
    "loans",
    "vendor",
    "vendors",
    "appraisal",
    "title company",
    "crm",
    "hubspot",
    "encompass"
  ];

  const questionLower = lastQuestion.toLowerCase();
  const hasUnsupportedDetail = unsupportedTerms.some(
    (term) => questionLower.includes(term) && !evidence.includes(term)
  );

  if (!hasUnsupportedDetail) {
    return response;
  }

  const idx = response.lastIndexOf(lastQuestion);
  if (idx === -1) {
    return response;
  }

  return `${response.substring(0, idx)}${nextQuestion}${response.substring(idx + lastQuestion.length)}`;
}

export function enforceEarlyRecommendationGuard(
  response: string,
  collectedMemory: RequirementMemory,
  recentConversation: string,
  userMessage: string,
  nextQuestion: string | null
): string {
  const clientEvidence = [
    userMessage,
    ...recentConversation
      .split(/\n(?=(?:user|assistant):)/i)
      .filter((line) => /^user:/i.test(line.trim()))
  ].join("\n");
  const unsupportedSpecifics = [
    /\bGLBA\b/i,
    /\bCFPB\b/i,
    /\bmulti-factor authentication\b|\bMFA\b/i,
    /\bencryption architecture\b/i,
    /\bsecure (?:loan|lending|servicing) platform\b/i,
    /\bcustom (?:Encompass )?plugin\b/i,
    /\binternal operations portal\b/i,
    /\bEncompass\b/i,
    /\bHubSpot\b/i,
    /\bSalesforce\b/i
  ];
  const hasUnsupportedSpecific = unsupportedSpecifics.some(
    (pattern) => pattern.test(response) && !pattern.test(clientEvidence)
  ) || textContainsRejectedFact(response, collectedMemory);

  if (hasUnsupportedSpecific) {
    const question = nextQuestion || evaluateConversationState({
      memory: collectedMemory,
      recentConversation,
      lastUserMessage: userMessage
    }).nextQuestion;
    const language = detectUserLanguage(userMessage);
    const observation = language === "roman_urdu"
      ? "Hum confirmed requirements ko product-neutral rakhte hue agla relevant detail clear karte hain."
      : "We'll keep the discussion product-neutral and work only from the requirements you have confirmed.";
    return question ? `${observation}\n\n${question}` : observation;
  }

  const state = evaluateConversationState({
    memory: collectedMemory,
    recentConversation,
    lastUserMessage: userMessage
  });

  const solutionReady = Boolean(
    state.completed.problem &&
      state.completed.current_process &&
      state.completed.primary_bottleneck &&
      state.completed.root_cause_validated &&
      state.completed.desired_outcome &&
      state.completed.systems_constraints
  );

  if (solutionReady || ["solution_direction", "recommendation", "qualification", "lead_capture", "project_brief"].includes(state.stage)) {
    return response;
  }

  const exposesRecommendation =
    /\b(automation can help|automated alerts can help|analytics can help|dashboard|dashboards|plugin|plugins|platform|product demo|custom demonstrations?|loan management software|commercial lending software|our solution supports|we can provide|sharepoint|integration|integrations|ai solution|ai solutions|we can implement|we recommend|recommended approach|recommended direction|solution direction|best solution|centralized status view|workflow automation|system integration|awesomeTech can help)\b/i.test(
      response
    );

  if (!exposesRecommendation) {
    return response;
  }

  const question = nextQuestion || state.nextQuestion;
  if (!question) {
    return response;
  }

  const language = detectUserLanguage(userMessage);
  const observation =
    language === "roman_urdu"
      ? "Pehle current workflow aur bottleneck ko thora aur clear kar lete hain."
      : "Let's clarify the current workflow and bottleneck before discussing options.";

  return `${observation}\n\n${question}`;
}

function isGenericCurrentProcessQuestion(question: string) {
  const normalized = question.toLowerCase();

  return (
    normalized.includes("walk me through how this process works today") ||
    normalized.includes("walk me through one of the manual processes") ||
    normalized.includes("which specific process is creating")
  );
}

export function isExplicitHandoffApproval(message: string) {
  const normalized = message.toLowerCase();
  const hasApproval =
    /\b(brief looks good|this looks good|that works|sounds good|brief is approved|approved|consider this ready|looks good from our side)\b/i.test(normalized) ||
    /\b(use|share|review) (?:this |the )?corrected brief\b/i.test(normalized) ||
    /\buse (?:this |the )?(?:corrected )?brief for (?:the )?(?:workflow )?scoping session\b/i.test(normalized);
  const hasHandoffIntent =
    /\b(follow up|we(?:'re| are) ready for next steps?|ready for (?:your )?team|have your team review|take it from here|share this with your team|move forward)\b/i.test(normalized);

  return hasApproval || hasHandoffIntent;
}

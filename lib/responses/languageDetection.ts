export function detectUserLanguage(message: string): "english" | "roman_urdu" {
  const cleanText = message.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = cleanText.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "english";
  }

  // Strong specific Roman Urdu keywords (exact match or prefix match)
  const strongRomanUrdu = new Set([
    "aap", "aapko", "aapke", "aapki", "apki", "apke", "apko", "apka",
    "mujhy", "mujhe", "btao", "batao", "kia", "kya", "kesy", "kaisay",
    "skty", "sakty", "chahiye", "chaiye", "samjhao", "samjha", "nahin", "nahi",
    "hein", "bhot", "bahut", "isko", "krwana", "hoti", "krty", "krte",
    "madad", "zaroorat", "zarorat", "theek", "pehle", "karo", "kru",
    "karen", "kary", "raha", "rha", "rhi", "rhy", "batao", "btao", "smjhao",
    "hoga", "hogi", "hongy", "kyun", "kese", "kesy", "lekin", "magar", "krna"
  ]);

  // Weak/short Roman Urdu keywords (only match if exact)
  const weakRomanUrdu = new Set([
    "ap", "kr", "kar", "ye", "hai", "ni", "nai", "hum", "ho", "bhi", "woh", "yeh", "ka", "ki", "ke", "ko", "se", "me", "mein", "main", "hy", "ha", "ya", "phr", "phir", "jo", "liye", "tha", "thi", "q", "a"
  ]);

  const englishKeywords = new Set([
    "the", "and", "with", "that", "this", "what", "which", "where",
    "when", "how", "why", "can", "could", "would", "should", "team",
    "teams", "customer", "customers", "support", "operations", "management",
    "process", "workflow", "status", "update", "updates", "information",
    "manual", "spreadsheet", "email", "business", "project", "build", "issue", "fix",
    "discuss", "scoping", "session", "meeting", "contact", "details", "brief"
  ]);

  let romanScore = 0;
  let englishScore = 0;

  for (const word of words) {
    if (englishKeywords.has(word)) {
      englishScore++;
    } else if (strongRomanUrdu.has(word)) {
      romanScore++;
    } else if (weakRomanUrdu.has(word)) {
      romanScore += 0.5; // half weight for weak/short particles
    } else {
      // Check if word starts with any strong Roman Urdu root (longer than 2 chars)
      for (const root of strongRomanUrdu) {
        if (root.length > 2 && word.startsWith(root)) {
          romanScore++;
          break;
        }
      }
    }
  }

  // To be classified as Roman Urdu, we need a clear score threshold
  // and the Roman Urdu score must exceed the English score.
  if (romanScore >= 2 && romanScore > englishScore) {
    return "roman_urdu";
  }

  return "english";
}


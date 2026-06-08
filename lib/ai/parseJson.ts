export function parseJsonObject<T extends Record<string, unknown>>(value: string) {
  const trimmedValue = value.trim();
  const fencedMatch = trimmedValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fencedMatch?.[1] ?? trimmedValue;
  const objectMatch = jsonCandidate.match(/\{[\s\S]*\}/);

  if (!objectMatch) {
    return null;
  }

  try {
    const parsed = JSON.parse(objectMatch[0]);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    return null;
  }

  return null;
}

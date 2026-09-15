const isDebugEnabled =
  process.env.NODE_ENV !== "production" || process.env.RUNTIME_DEBUG === "true";

export function runtimeDebug(message: string, ...details: unknown[]) {
  if (isDebugEnabled) {
    console.log(message, ...details);
  }
}

export function runtimeWarn(message: string, ...details: unknown[]) {
  console.warn(message, ...details);
}

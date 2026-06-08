import { NextRequest, NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function rateLimit(request: NextRequest, options: {
  keyPrefix: string;
  limit: number;
  windowMs: number;
}) {
  const key = `${options.keyPrefix}:${getClientKey(request)}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs
    });

    return null;
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return NextResponse.json(
      { error: "Too many requests. Please wait and try again." },
      { status: 429 }
    );
  }

  return null;
}

function getClientKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

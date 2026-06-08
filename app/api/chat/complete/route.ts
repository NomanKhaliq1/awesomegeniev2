import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { completeOnboarding } from "@/lib/chat/completeOnboarding";

const bodySchema = z.object({
  sessionId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "chat-complete",
    limit: 8,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid complete request." },
      { status: 400 }
    );
  }

  try {
    const result = await completeOnboarding(parsed.data.sessionId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Complete onboarding failed:", error);
    return NextResponse.json(
      { error: "Project brief could not be generated." },
      { status: 500 }
    );
  }
}

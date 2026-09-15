import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { getChatSession } from "@/lib/data/chatRepository";
import {
  feedbackTags,
  saveSessionFeedback
} from "@/lib/data/feedbackRepository";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(feedbackTags)).max(feedbackTags.length).default([]),
  comment: z.string().trim().max(1000).default("")
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "chat-feedback",
    limit: 10,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }

  const session = await getChatSession(parsed.data.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Chat session was not found." }, { status: 404 });
  }

  if (session.status !== "completed") {
    return NextResponse.json(
      { error: "Feedback is available after onboarding is complete." },
      { status: 409 }
    );
  }

  const result = await saveSessionFeedback(parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Feedback could not be saved." }, { status: 500 });
  }

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}

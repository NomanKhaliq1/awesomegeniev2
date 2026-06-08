import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { handleMessage } from "@/lib/chat/handleMessage";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "chat-message",
    limit: 30,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid chat message request." },
      { status: 400 }
    );
  }

  try {
    const response = await handleMessage(parsed.data.sessionId, parsed.data.message);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat message failed:", error);
    return NextResponse.json(
      { error: "Message could not be processed." },
      { status: 500 }
    );
  }
}

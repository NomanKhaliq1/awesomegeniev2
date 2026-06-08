import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { getSystemSetting } from "@/lib/data/settingsRepository";
import { startSession } from "@/lib/chat/startSession";
import { getStateLabel, type OnboardingState } from "@/lib/onboarding/stateMachine";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "chat-start",
    limit: 20,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  try {
    const { openingMessage, firstQuestion, ...session } = await startSession();
    const [appText, statusLabel] = await Promise.all([
      getSystemSetting("app_text_labels"),
      getStateLabel(session.status as OnboardingState)
    ]);

    return NextResponse.json({
      session,
      statusLabel,
      message: openingMessage,
      firstQuestion,
      appText
    });
  } catch (error) {
    console.error("Chat start failed:", error);
    return NextResponse.json(
      { error: "Chat session could not be started." },
      { status: 500 }
    );
  }
}

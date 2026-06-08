import { NextResponse } from "next/server";
import {
  getChatSession,
  listChatMessages
} from "@/lib/data/chatRepository";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getChatSession(context.params.id);

  if (session) {
    const messages = await listChatMessages(context.params.id);

    return NextResponse.json(
      {
        session: {
          id: session.id,
          startedAt: session.started_at,
          completionScore: session.completion_score,
          missingFields: session.missing_fields,
          status: session.status,
          persisted: true
        },
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at
        }))
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  }

  return NextResponse.json(
    {
      id: context.params.id,
      status: "not_persisted",
      message: "Supabase chat session persistence is not configured yet."
    },
    {
      status: 202,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}

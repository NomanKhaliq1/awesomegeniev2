import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runWebsiteSync } from "@/lib/sync/runWebsiteSync";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 503 }
    );
  }

  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runWebsiteSync({
      maxUrls: 50,
      ingest: true,
      jobType: "scheduled_website_sync"
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scheduled website sync failed:", error);
    return NextResponse.json(
      { error: "Scheduled website sync failed." },
      { status: 500 }
    );
  }
}

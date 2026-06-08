import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { env } from "@/lib/env";
import { runWebsiteSync } from "@/lib/sync/runWebsiteSync";

const bodySchema = z.object({
  maxUrls: z.number().int().positive().max(500).optional(),
  ingest: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "website-sync",
    limit: 5,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  if (env.WORDPRESS_WEBHOOK_SECRET) {
    const secret =
      request.headers.get("x-sync-secret") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (secret !== env.WORDPRESS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });
  }

  try {
    const result = await runWebsiteSync({
      maxUrls: parsed.data.maxUrls ?? 25,
      ingest: parsed.data.ingest ?? true,
      jobType: "manual_website_sync"
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Website sync failed:", error);
    return NextResponse.json({ error: "Website sync failed." }, { status: 500 });
  }
}

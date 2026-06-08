import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { env } from "@/lib/env";
import { insertWebhookEvent } from "@/lib/data/syncRepository";
import { runWebsiteSync } from "@/lib/sync/runWebsiteSync";

const webhookSchema = z.object({
  url: z.string().url().optional(),
  post_url: z.string().url().optional(),
  permalink: z.string().url().optional(),
  lastmod: z.string().optional(),
  event: z.string().optional()
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    keyPrefix: "wordpress-webhook",
    limit: 20,
    windowMs: 60_000
  });

  if (limited) {
    return limited;
  }

  const secret =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (env.WORDPRESS_WEBHOOK_SECRET && secret !== env.WORDPRESS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = webhookSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const url = parsed.data.url ?? parsed.data.post_url ?? parsed.data.permalink;

  await insertWebhookEvent({
    source: "wordpress",
    eventType: parsed.data.event ?? "content_updated",
    payload,
    status: url ? "processing" : "ignored"
  });

  if (!url) {
    return NextResponse.json({
      status: "ignored",
      reason: "No URL supplied."
    });
  }

  try {
    const result = await runWebsiteSync({
      urls: [
        {
          loc: url,
          lastmod: parsed.data.lastmod ?? null
        }
      ],
      maxUrls: 1,
      ingest: true,
      jobType: "wordpress_webhook_sync"
    });

    return NextResponse.json({
      status: "processed",
      result
    });
  } catch (error) {
    console.error("WordPress webhook sync failed:", error);
    return NextResponse.json({ error: "Webhook sync failed." }, { status: 500 });
  }
}

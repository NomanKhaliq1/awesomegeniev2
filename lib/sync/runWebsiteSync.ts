import {
  completeSyncJob,
  completeSyncJobItem,
  createSyncJob,
  createSyncJobItem
} from "@/lib/data/syncRepository";
import { ingestWebsiteChunksToPinecone } from "@/lib/langchain/ingestWebsiteChunksToPinecone";
import { fetchSitemap, type SitemapUrl } from "./fetchSitemap";
import { syncSingleUrl } from "./syncSingleUrl";

export type WebsiteSyncResult = {
  totalFound: number;
  selected: number;
  synced: number;
  skipped: number;
  failed: number;
  vectorsUpserted: number;
};

export async function runWebsiteSync({
  maxUrls = 25,
  urls,
  ingest = true,
  jobType = "website_sitemap_sync",
  concurrency = 6
}: {
  maxUrls?: number;
  urls?: SitemapUrl[];
  ingest?: boolean;
  jobType?: string;
  concurrency?: number;
} = {}): Promise<WebsiteSyncResult> {
  const job = await createSyncJob({
    jobType,
    metadata: {
      maxUrls,
      ingest
    }
  });
  const sitemapUrls = urls ?? (await fetchSitemap());
  const selectedUrls = sitemapUrls
    .filter((entry) => shouldSyncUrl(entry.loc))
    .slice(0, Number.isFinite(maxUrls) ? maxUrls : 25);
  const result: WebsiteSyncResult = {
    totalFound: sitemapUrls.length,
    selected: selectedUrls.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    vectorsUpserted: 0
  };

  try {
    await runWithConcurrency(selectedUrls, concurrency, async (entry) => {
      const item = job
        ? await createSyncJobItem({
            syncJobId: job.id,
            url: entry.loc,
            metadata: {
              lastmod: entry.lastmod
            }
          })
        : null;

      try {
        const synced = await syncSingleUrl({
          url: entry.loc,
          lastmod: entry.lastmod,
          approvedForRag: true
        });

        if (synced.skipped) {
          result.skipped += 1;
        } else {
          result.synced += 1;
        }

        if (item) {
          await completeSyncJobItem({
            itemId: item.id,
            status: synced.skipped ? "skipped" : "completed",
            metadata: synced
          });
        }
      } catch (error) {
        result.failed += 1;

        if (item) {
          await completeSyncJobItem({
            itemId: item.id,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown sync error"
          });
        }
      }
    });

    if (ingest && result.synced > 0) {
      const ingestResult = await ingestWebsiteChunksToPinecone();
      result.vectorsUpserted = ingestResult.vectorsUpserted;
    }

    if (job) {
      await completeSyncJob({
        jobId: job.id,
        status: result.failed > 0 ? "failed" : "completed",
        metadata: result
      });
    }

    return result;
  } catch (error) {
    if (job) {
      await completeSyncJob({
        jobId: job.id,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown sync job error",
        metadata: result
      });
    }

    throw error;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await worker(items[currentIndex]);
      }
    })
  );
}

export function shouldSyncUrl(url: string) {
  return ![
    "/wp-content/",
    "/tag/",
    "/category/",
    "/author/",
    "?",
    "#"
  ].some((blocked) => url.includes(blocked));
}

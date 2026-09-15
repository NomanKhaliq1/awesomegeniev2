import { loadEnvConfig } from "@next/env";
import dns from "dns";

loadEnvConfig(process.cwd());
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function main() {
  const { runWebsiteSync } = await import("@/lib/sync/runWebsiteSync");
  const maxUrls = Number(process.env.SYNC_WEBSITE_MAX_URLS ?? 8);
  const result = await runWebsiteSync({
    maxUrls: Number.isFinite(maxUrls) ? maxUrls : 8,
    ingest: process.env.SYNC_WEBSITE_INGEST !== "false"
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};

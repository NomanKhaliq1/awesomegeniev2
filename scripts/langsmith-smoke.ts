import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { generateWithSlm } = await import("@/lib/ai/modelClient");
  const content = await generateWithSlm({
    task: "langsmith-direct-model-check",
    system: "Return only compact JSON.",
    user: 'Return {"ok":true}',
    temperature: 0
  });

  console.log(content.slice(0, 200));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

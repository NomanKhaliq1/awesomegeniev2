import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { routeMessage } = await import("@/lib/agents/routerAgent");
  
  const msg = "Aap mujhy apni AI automation services explain kar skty ho?";

  console.log(`Routing for "${msg}":`);
  const r = await routeMessage(msg);
  console.log(JSON.stringify(r, null, 2));
}

main().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");

  console.log("Starting a fresh session...");
  const session = await startSession();
  console.log(`Session started: ${session.id}`);

  const msg = "Aap mujhy apni AI automation services explain kar skty ho?";
  console.log(`Sending message: "${msg}"`);
  const response = await handleMessage(session.id, msg);
  console.log("Response:");
  console.log(response.message);
}

main().catch(console.error);

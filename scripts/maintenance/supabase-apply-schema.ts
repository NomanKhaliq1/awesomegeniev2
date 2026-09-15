import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

loadEnvConfig(process.cwd());

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local.`);
  }

  return value;
}

async function main() {
  const connectionString = requireEnv("SUPABASE_DATABASE_URL");
  const schemaPath = resolve(process.cwd(), "supabase", "schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  await client.connect();

  try {
    await client.query(schemaSql);
    console.log("Supabase schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};

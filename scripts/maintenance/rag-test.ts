import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const sampleQueries = [
  "Do you build mortgage websites?",
  "Do you provide MISMO integration?",
  "Do you work with Encompass?",
  "Do you provide Power BI dashboards?",
  "How can I contact AwesomeTech?"
];

async function main() {
  const { retrieveWebsiteChunksFromPinecone } = await import(
    "@/lib/langchain/retrieveWebsiteChunksFromPinecone"
  );

  for (const query of sampleQueries) {
    console.log(`\nQuery: ${query}`);
    const matches = await retrieveWebsiteChunksFromPinecone(query, 3);

    if (matches.length === 0) {
      console.log("No matches.");
      continue;
    }

    matches.forEach((match, index) => {
      console.log(`${index + 1}. score=${match.score.toFixed(4)} id=${match.id}`);
      console.log(`   source=${match.sourceUrl ?? "unknown"}`);
      console.log(`   preview=${match.text.slice(0, 180).replace(/\s+/g, " ")}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export {};

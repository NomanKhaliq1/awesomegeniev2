import crypto from "crypto";
import { env } from "@/lib/env";

type TraceInput = {
  name: string;
  runType: string;
  inputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type TraceHandle = {
  id: string;
  end: (input: { outputs?: Record<string, unknown>; error?: string }) => Promise<void>;
};

let tracingDisabled = false;

export function isLangSmithEnabled() {
  return (
    env.LANGCHAIN_TRACING_V2 === "true" &&
    Boolean(env.LANGCHAIN_API_KEY) &&
    Boolean(env.LANGCHAIN_PROJECT)
  );
}

export async function startLangSmithRun(input: TraceInput): Promise<TraceHandle | null> {
  if (!isLangSmithEnabled() || tracingDisabled) {
    return null;
  }

  const id = crypto.randomUUID();

  try {
    const { Client } = await import("langsmith");
    const client = new Client({
      apiKey: env.LANGCHAIN_API_KEY
    });

    await client.createRun({
      id,
      name: input.name,
      run_type: input.runType,
      project_name: env.LANGCHAIN_PROJECT,
      inputs: input.inputs,
      extra: {
        metadata: {
          app: "awesome-genie",
          ...input.metadata
        }
      }
    });

    return {
      id,
      end: async ({ outputs, error }) => {
        try {
          await client.updateRun(id, {
            outputs,
            error
          });
          await client.awaitPendingTraceBatches();
        } catch (updateError) {
          console.error(
            "LangSmith updateRun failed:",
            updateError instanceof Error ? updateError.message : updateError
          );
        }
      }
    };
  } catch (error) {
    tracingDisabled = true;
    console.error(
      "LangSmith createRun failed; tracing disabled for this process:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

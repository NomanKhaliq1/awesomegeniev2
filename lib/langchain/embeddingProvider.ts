import { env } from "@/lib/env";

type FeatureExtractionPipeline = (
  input: string | string[],
  options: {
    pooling: "mean";
    normalize: boolean;
  }
) => Promise<{
  data: Float32Array;
  dims: number[];
}>;

let localPipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

export async function embedText(text: string) {
  const vectors = await embedTexts([text]);
  return vectors[0];
}

export async function embedTexts(texts: string[]) {
  if (env.EMBEDDING_PROVIDER !== "local") {
    throw new Error(`Unsupported embedding provider: ${env.EMBEDDING_PROVIDER}`);
  }

  const pipeline = await getLocalPipeline();
  const embeddings: number[][] = [];

  for (const text of texts) {
    const output = await pipeline(normalizeText(text), {
      pooling: "mean",
      normalize: true
    });
    const vector = Array.from(output.data);

    validateEmbeddingDimension(vector);
    embeddings.push(vector);
  }

  return embeddings;
}

async function getLocalPipeline() {
  if (!localPipelinePromise) {
    localPipelinePromise = loadLocalPipeline();
  }

  return localPipelinePromise;
}

async function loadLocalPipeline() {
  const { pipeline } = (await importRuntimeModule("@xenova/transformers")) as {
    pipeline: (
      task: "feature-extraction",
      model: string
    ) => Promise<FeatureExtractionPipeline>;
  };
  const model = resolveLocalModelName(
    env.EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2"
  );

  return pipeline("feature-extraction", model) as Promise<FeatureExtractionPipeline>;
}

async function importRuntimeModule(specifier: string) {
  const importer = new Function("specifier", "return import(specifier)") as (
    moduleSpecifier: string
  ) => Promise<unknown>;

  return importer(specifier);
}

function resolveLocalModelName(model: string) {
  if (model === "sentence-transformers/all-MiniLM-L6-v2") {
    return "Xenova/all-MiniLM-L6-v2";
  }

  return model;
}

function validateEmbeddingDimension(vector: number[]) {
  const expectedDimension = Number(env.EMBEDDING_DIMENSION);

  if (!Number.isFinite(expectedDimension)) {
    throw new Error("EMBEDDING_DIMENSION must be configured.");
  }

  if (vector.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch. Expected ${expectedDimension}, received ${vector.length}.`
    );
  }
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

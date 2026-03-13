import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import type { Document as MongoDocument, Collection } from "mongodb";

type EmbeddingProvider = "local" | "inference";

function resolveEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (provider === "inference") return "inference";
  return "local";
}

function resolveEmbeddingDimensions(): number {
  const raw = Number(process.env.EMBEDDING_DIMENSIONS ?? "384");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 384;
}

const embeddingProvider = resolveEmbeddingProvider();
const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
const embeddingModel = process.env.EMBEDDING_MODEL?.trim()
  ? process.env.EMBEDDING_MODEL
  : embeddingProvider === "local"
    ? "Xenova/all-MiniLM-L6-v2"
    : "sentence-transformers/all-MiniLM-L6-v2";
const embeddingEndpoint = process.env.EMBEDDING_BASE_URL;
const vectorIndexName =
  process.env.MONGODB_VECTOR_INDEX || "document_chunks_vector_index";
export const embeddingDimensions = resolveEmbeddingDimensions();

let embeddingsModel:
  | HuggingFaceInferenceEmbeddings
  | HuggingFaceTransformersEmbeddings
  | null = null;

export function isEmbeddingConfigured(): boolean {
  if (embeddingProvider === "local") return true;
  return Boolean(huggingFaceApiKey);
}

export function getEmbeddingsModel():
  | HuggingFaceInferenceEmbeddings
  | HuggingFaceTransformersEmbeddings {
  if (embeddingProvider === "inference" && !huggingFaceApiKey) {
    throw new Error(
      "Set HUGGINGFACE_API_KEY when EMBEDDING_PROVIDER=inference.",
    );
  }

  if (!embeddingsModel) {
    embeddingsModel =
      embeddingProvider === "local"
        ? new HuggingFaceTransformersEmbeddings({
            model: embeddingModel,
          })
        : new HuggingFaceInferenceEmbeddings({
            apiKey: huggingFaceApiKey,
            model: embeddingModel,
            endpointUrl: embeddingEndpoint,
          });
  }

  return embeddingsModel;
}

export function getMongoVectorStore(
  collection: Collection<MongoDocument>,
): MongoDBAtlasVectorSearch {
  return new MongoDBAtlasVectorSearch(getEmbeddingsModel(), {
    collection: collection as never,
    indexName: vectorIndexName,
    textKey: "text",
    embeddingKey: "embedding",
  });
}

export async function createEmbedding(text: string): Promise<number[]> {
  return getEmbeddingsModel().embedQuery(text);
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return getEmbeddingsModel().embedDocuments(texts);
}

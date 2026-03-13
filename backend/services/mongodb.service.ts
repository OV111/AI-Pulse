import {
  MongoClient,
  ServerApiVersion,
  type ObjectId,
  type Collection,
  type Db,
} from "mongodb";
import type { ChatMessage } from "../types/chat";
import { embeddingDimensions } from "./embedding.service";

export type ChatSessionDocument = {
  documentId?: string;
  type?: "general";
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRecord = {
  _id?: ObjectId;
  name: string;
  originalName?: string;
  type?: string;
  size?: number;
  extractedText?: string;
  chunkCount?: number;
  uploadedAt?: Date;
  status?: "processing" | "ready" | "error";
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type DocumentChunkRecord = {
  _id?: ObjectId;
  documentId: ObjectId;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  createdAt: Date;
};

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || "RAG-DB";
const vectorIndexName =
  process.env.MONGODB_VECTOR_INDEX || "document_chunks_vector_index";
const mongoApiStrict = process.env.MONGODB_API_STRICT === "true";

if (!mongoUri) {
  console.warn(
    "MONGODB_URI is not set. Database features will fail until it is configured.",
  );
}

const client = new MongoClient(mongoUri || "mongodb://127.0.0.1:27017", {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: mongoApiStrict,
    deprecationErrors: true,
  },
});

let database: Db | null = null;

async function ensureVectorSearchIndex(db: Db): Promise<void> {
  if (mongoApiStrict) {
    console.log(
      "Skipping automatic vector index creation because MONGODB_API_STRICT=true.",
    );
    return;
  }

  const chunksCollection = db.collection<DocumentChunkRecord>("DocumentChunks");

  try {
    await chunksCollection.createSearchIndex({
      name: vectorIndexName,
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: embeddingDimensions,
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "documentId",
          },
        ],
      },
    } as never);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already exists")) return;
    console.warn("Vector search index setup skipped:", message);
  }
}

export async function connectToDatabase(): Promise<Db> {
  if (database) return database;

  await client.connect();
  database = client.db(mongoDbName);
  await ensureVectorSearchIndex(database);
  return database;
}

export function getChatsCollection(): Collection<ChatSessionDocument> {
  if (!database) {
    throw new Error("Database is not connected. Call connectToDatabase first.");
  }
  return database.collection<ChatSessionDocument>("Chats");
}

export function getDocumentsCollection(): Collection<DocumentRecord> {
  if (!database) {
    throw new Error("Database is not connected. Call connectToDatabase first.");
  }
  return database.collection<DocumentRecord>("Documents");
}

export function getDocumentChunksCollection(): Collection<DocumentChunkRecord> {
  if (!database) {
    throw new Error("Database is not connected. Call connectToDatabase first.");
  }
  return database.collection<DocumentChunkRecord>("DocumentChunks");
}

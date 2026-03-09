import {
  MongoClient,
  ServerApiVersion,
  type Collection,
  type Db,
} from "mongodb";
import type { ChatMessage } from "../types/chat";

export type ChatSessionDocument = {
  documentId?: string;
  type?: "general";
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentRecord = {
  _id?: unknown;
  name: string;
  originalName?: string;
  status?: "processing" | "ready" | "error";
};

const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB_NAME || "RAG-DB";

if (!mongoUri) {
  console.warn(
    "MONGODB_URI is not set. Database features will fail until it is configured.",
  );
}

const client = new MongoClient(mongoUri || "mongodb://127.0.0.1:27017", {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let database: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (database) return database;

  await client.connect();
  database = client.db(mongoDbName);
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

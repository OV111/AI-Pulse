import Groq from "groq-sdk";
import { ObjectId } from "mongodb";
import type { ChatMessage } from "../types/chat";
import {
  getDocumentChunksCollection,
  getDocumentsCollection,
} from "./mongodb.service";
import {
  getMongoVectorStore,
  isEmbeddingConfigured,
} from "./embedding.service";

type GenerateReplyInput = {
  messages: ChatMessage[];
  mode: "document" | "general";
  documentId?: string;
};

const groqClient = process.env.GROQ_KEY
  ? new Groq({ apiKey: process.env.GROQ_KEY })
  : null;

const BASE_SYSTEM_PROMPT = `
You are a helpful, intelligent, and friendly AI assistant.

Your goals:
- Provide clear, accurate, and helpful answers.
- Explain complex topics in a simple and understandable way.
- Use structured responses when helpful (lists, steps, short paragraphs).
- Be concise but informative.

Guidelines:
- If you are unsure about something, say so honestly.
- Do not invent facts.
- When explaining technical topics, include practical examples.
- Maintain a professional and respectful tone.

Always prioritize clarity, usefulness, and accuracy in your responses.
`;

type RetrievedChunk = {
  documentId: ObjectId;
  chunkIndex: number;
  text: string;
  score: number;
};

function extractKeywords(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(tokens)].slice(0, 14);
}

function scoreChunkAgainstKeywords(
  chunkText: string,
  keywords: string[],
): number {
  const content = chunkText.toLowerCase();
  return keywords.reduce(
    (total, keyword) => total + (content.includes(keyword) ? 1 : 0),
    0,
  );
}

async function vectorSearchInMongo(input: {
  latestUserMessage: string;
  mode: "document" | "general";
  documentId?: string;
}): Promise<RetrievedChunk[]> {
  const { latestUserMessage, mode, documentId } = input;
  const chunksCollection = getDocumentChunksCollection();
  const vectorStore = getMongoVectorStore(chunksCollection as never);
  const filter =
    mode === "document" && documentId && ObjectId.isValid(documentId)
      ? { preFilter: { documentId: new ObjectId(documentId) } }
      : undefined;
  const matches = await vectorStore.similaritySearchWithScore(
    latestUserMessage,
    6,
    filter,
  );

  return matches.map(([document, score]) => ({
    documentId: document.metadata.documentId as ObjectId,
    chunkIndex:
      typeof document.metadata.chunkIndex === "number"
        ? document.metadata.chunkIndex
        : 0,
    text: document.pageContent,
    score,
  }));
}

async function vectorSearchFallback(input: {
  latestUserMessage: string;
  mode: "document" | "general";
  documentId?: string;
}): Promise<RetrievedChunk[]> {
  const { latestUserMessage, mode, documentId } = input;
  const chunksCollection = getDocumentChunksCollection();
  const filter: Record<string, unknown> = {};

  if (mode === "document" && documentId && ObjectId.isValid(documentId)) {
    filter.documentId = new ObjectId(documentId);
  }

  const queryTerms = extractKeywords(latestUserMessage);
  if (queryTerms.length === 0) return [];

  const candidates = await chunksCollection
    .find(filter, {
      projection: { documentId: 1, chunkIndex: 1, text: 1 },
      limit: mode === "general" ? 400 : 200,
    })
    .toArray();

  return candidates
    .map((chunk) => ({
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score: scoreChunkAgainstKeywords(chunk.text, queryTerms),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, 6);
}

async function buildRetrievedContext(input: {
  latestUserMessage: string;
  mode: "document" | "general";
  documentId?: string;
}): Promise<string> {
  const { latestUserMessage, mode, documentId } = input;
  if (!isEmbeddingConfigured()) {
    const keywordScored = await keywordSearchFallback({
      latestUserMessage,
      mode,
      documentId,
    });
    if (keywordScored.length === 0) return "";
    const contextBlocks = await buildContextBlocks(keywordScored);
    return contextBlocks.join("\n\n");
  }

  let scored: RetrievedChunk[];
  try {
    scored = await vectorSearchInMongo({ latestUserMessage, mode, documentId });
  } catch (error) {
    console.warn(
      "MongoDB vector search failed. Falling back to keyword scan.",
      error,
    );
    scored = await vectorSearchFallback({
      latestUserMessage,
      mode,
      documentId,
    });
  }

  if (scored.length === 0) return "";

  const contextBlocks = await buildContextBlocks(scored);
  return contextBlocks.join("\n\n");
}

async function keywordSearchFallback(input: {
  latestUserMessage: string;
  mode: "document" | "general";
  documentId?: string;
}): Promise<RetrievedChunk[]> {
  const { latestUserMessage, mode, documentId } = input;
  const keywords = extractKeywords(latestUserMessage);
  if (keywords.length === 0) return [];

  const chunksCollection = getDocumentChunksCollection();
  const filter: Record<string, unknown> = {};
  if (mode === "document" && documentId && ObjectId.isValid(documentId)) {
    filter.documentId = new ObjectId(documentId);
  }

  const candidates = await chunksCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(mode === "general" ? 400 : 200)
    .toArray();

  return candidates
    .map((candidate) => ({
      documentId: candidate.documentId,
      chunkIndex: candidate.chunkIndex,
      text: candidate.text,
      score: scoreChunkAgainstKeywords(candidate.text, keywords),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, 6);
}

async function buildContextBlocks(scored: RetrievedChunk[]): Promise<string[]> {
  if (scored.length === 0) return [];

  const documentIds = [
    ...new Set(scored.map((item) => item.documentId.toString())),
  ];
  const documentsCollection = getDocumentsCollection();
  const documentRows = await documentsCollection
    .find({ _id: { $in: documentIds.map((id) => new ObjectId(id)) } })
    .toArray();
  const docNameMap = new Map(
    documentRows.map((doc) => [
      doc._id?.toString() ?? "",
      doc.originalName || doc.name,
    ]),
  );

  return scored.map((item, index) => {
    const docName =
      docNameMap.get(item.documentId.toString()) || "Unknown document";
    return `[Snippet ${index + 1}] ${docName} (chunk ${item.chunkIndex + 1}): ${item.text}`;
  });
}

export async function generateAssistantReply(
  input: GenerateReplyInput,
): Promise<string> {
  const { messages, mode, documentId } = input;
  const latestUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user")?.content;

  if (!latestUserMessage) {
    return "I did not receive a user question.";
  }

  if (!groqClient) {
    const scopeText =
      mode === "general"
        ? "all uploaded documents"
        : `document ${documentId ?? "unknown"}`;
    return `I received your question about ${scopeText}: "${latestUserMessage}". LLM provider is not configured yet, so this is a placeholder response.`;
  }

  const scopePrompt =
    mode === "general"
      ? "Scope: All uploaded documents."
      : `Scope: Document ID ${documentId ?? "unknown"}.`;
  let retrievedContext = "";

  try {
    retrievedContext = await buildRetrievedContext({
      latestUserMessage,
      mode,
      documentId,
    });
  } catch (error) {
    console.error("Context retrieval failed:", error);
  }

  const retrievalPrompt = retrievedContext
    ? `Use the retrieved context below as the primary source.\n\n${retrievedContext}`
    : "No relevant context was found in uploaded documents. Be explicit about uncertainty.";

  try {
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `${BASE_SYSTEM_PROMPT} ${scopePrompt}\n\n${retrievalPrompt}`,
        },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || "No response.";
  } catch (error) {
    console.error("Groq generation failed:", error);
    return "I could not generate a response right now. Please try again.";
  }
}

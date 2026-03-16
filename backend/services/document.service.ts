import path from "node:path";
import { ObjectId } from "mongodb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document as LC_Document } from "@langchain/core/documents";
import { PDFParse } from "pdf-parse";
import type { TextResult } from "pdf-parse";
import {
  getDocumentChunksCollection,
  getDocumentsCollection,
} from "./mongodb.service";
import {
  getMongoVectorStore,
  isEmbeddingConfigured,
} from "./embedding.service";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

async function extractTextFromBuffer(
  fileBuffer: Buffer,
  originalName: string,
): Promise<string> {
  const extension = getFileExtension(originalName);

  if (
    extension === ".txt" ||
    extension === ".md" ||
    extension === ".markdown"
  ) {
    return normalizeText(fileBuffer.toString("utf-8"));
  }

  if (extension === ".pdf") {
    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const fullText = (parsed as TextResult).pages
      .map((page) => page.text)
      .join("\n\n");
    return normalizeText(fullText);
  }

  throw new Error("Only PDF, TXT, and Markdown files are supported");
}

export type UploadedDocumentDTO = {
  id: string;
  name: string;
  sizeKb: number;
  chunks: number;
  uploadedAt: string;
  status: "ready" | "processing" | "error";
};

export async function uploadDocumentFromBuffer(input: {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  size: number;
}): Promise<UploadedDocumentDTO> {
  const documentsCollection = getDocumentsCollection();
  const chunksCollection = getDocumentChunksCollection();
  const now = new Date();

  const extractedText = await extractTextFromBuffer(
    input.buffer,
    input.originalName,
  );
  if (!extractedText.trim()) {
    throw new Error("No readable text was found in the uploaded file");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const splitDocuments = await splitter.createDocuments([extractedText]);
  const chunks = splitDocuments
    .map((doc) => doc.pageContent.trim())
    .filter(Boolean);
  if (chunks.length === 0) {
    throw new Error("Document content is empty after extraction");
  }

  const baseName = path.basename(
    input.originalName,
    path.extname(input.originalName),
  );
  const docInsert = await documentsCollection.insertOne({
    name: baseName || input.originalName,
    originalName: input.originalName,
    type: input.mimetype,
    size: input.size,
    extractedText,
    chunkCount: chunks.length,
    uploadedAt: now,
    status: "processing",
    createdAt: now,
    updatedAt: now,
  });

  const result: UploadedDocumentDTO = {
    id: docInsert.insertedId.toString(),
    name: baseName || input.originalName,
    sizeKb: Math.max(1, Math.round(input.size / 1024)),
    chunks: chunks.length,
    uploadedAt: now.toISOString(),
    status: "processing",
  };

  // Always insert plain chunks first to guarantee data is saved
  const chunkDocs = chunks.map((text, chunkIndex) => ({
    documentId: docInsert.insertedId,
    chunkIndex,
    text,
    createdAt: now,
  }));
  await chunksCollection.insertMany(chunkDocs);

  // Run vector embedding in background
  void (async () => {
    try {
      if (isEmbeddingConfigured()) {
        const vectorStore = getMongoVectorStore(chunksCollection as never);
        const docs = chunks.map(
          (text, chunkIndex) =>
            new LC_Document({
              pageContent: text,
              metadata: {
                documentId: docInsert.insertedId,
                chunkIndex,
                createdAt: now,
              },
            }),
        );
        await vectorStore.addDocuments(docs);
      }
      await documentsCollection.updateOne(
        { _id: docInsert.insertedId },
        { $set: { status: "ready", updatedAt: new Date() } },
      );
    } catch (error) {
      console.error("Background embedding failed:", error);
      await documentsCollection.updateOne(
        { _id: docInsert.insertedId },
        { $set: { status: "error", updatedAt: new Date() } },
      );
    }
  })();

  return result;
}

export async function listUploadedDocuments(): Promise<UploadedDocumentDTO[]> {
  const documentsCollection = getDocumentsCollection();
  const documents = await documentsCollection
    .find({})
    .sort({ uploadedAt: -1, createdAt: -1 })
    .toArray();

  return documents.map((doc) => ({
    id: doc._id?.toString() ?? "",
    name: doc.originalName || doc.name,
    sizeKb: Math.max(1, Math.round((doc.size ?? 0) / 1024)),
    chunks: doc.chunkCount ?? 0,
    uploadedAt: (doc.uploadedAt ?? doc.createdAt ?? new Date()).toISOString(),
    status: doc.status ?? "ready",
  }));
}

export async function deleteDocumentById(documentId: string): Promise<boolean> {
  if (!ObjectId.isValid(documentId)) return false;

  const objectId = new ObjectId(documentId);
  const documentsCollection = getDocumentsCollection();
  const chunksCollection = getDocumentChunksCollection();

  const [docDeletion] = await Promise.all([
    documentsCollection.deleteOne({ _id: objectId }),
    chunksCollection.deleteMany({ documentId: objectId }),
  ]);

  return docDeletion.deletedCount > 0;
}

import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { generateAssistantReply } from "../services/llm.service";
import {
  getChatsCollection,
  getDocumentsCollection,
} from "../services/mongodb.service";
import type {
  ChatMessage,
  DocumentChatRequestBody,
  GeneralChatRequestBody,
} from "../types/chat";

function isValidMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as ChatMessage).role &&
      ((item as ChatMessage).role === "user" ||
        (item as ChatMessage).role === "assistant") &&
      typeof (item as ChatMessage).content === "string" &&
      (item as ChatMessage).content.trim().length > 0,
  );
}

export async function postDocumentChat(req: Request, res: Response) {
  try {
    const body = req.body as Partial<DocumentChatRequestBody>;

    if (!body.documentId || typeof body.documentId !== "string") {
      return res
        .status(400)
        .json({ error: "documentId is required and must be a string" });
    }

    if (!isValidMessageArray(body.messages)) {
      return res.status(400).json({
        error:
          "messages is required and must be a non-empty array of { role, content }",
      });
    }

    const documentsCollection = getDocumentsCollection();
    const filters: Array<Record<string, unknown>> = [{ name: body.documentId }];
    if (ObjectId.isValid(body.documentId)) {
      filters.push({ _id: new ObjectId(body.documentId) });
    }
    const existingDocument = await documentsCollection.findOne({
      $or: filters,
    });
    if (!existingDocument) {
      return res
        .status(404)
        .json({ error: "Document not found for provided documentId" });
    }

    const content = await generateAssistantReply({
      messages: body.messages,
      mode: "document",
      documentId: body.documentId,
    });

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content,
    };
    const fullConversation = [...body.messages, assistantMessage];
    const chatsCollection = getChatsCollection();
    const title = existingDocument.name || `Document ${body.documentId}`;

    await chatsCollection.updateOne(
      { documentId: body.documentId },
      {
        $set: {
          title,
          documentId: body.documentId,
          messages: fullConversation,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error("POST /chat failed:", error);
    return res.status(500).json({ error: "Failed to generate chat response" });
  }
}

export async function postGeneralChat(req: Request, res: Response) {
  try {
    const body = req.body as Partial<GeneralChatRequestBody>;

    if (!isValidMessageArray(body.messages)) {
      return res.status(400).json({
        error:
          "messages is required and must be a non-empty array of { role, content }",
      });
    }

    const content = await generateAssistantReply({
      messages: body.messages,
      mode: "general",
    });

    const assistantMessage: ChatMessage = {
      role: "assistant",
      content,
    };
    const chatsCollection = getChatsCollection();
    const fullConversation = [...body.messages, assistantMessage];

    await chatsCollection.updateOne(
      { type: "general" },
      {
        $set: {
          type: "general",
          title: "All Documents Chat",
          messages: fullConversation,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return res.status(200).json({
      message: assistantMessage,
    });
  } catch (error) {
    console.error("POST /chat/general failed:", error);
    return res.status(500).json({ error: "Failed to generate chat response" });
  }
}

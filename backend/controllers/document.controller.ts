import type { Request, Response } from "express";
import multer from "multer";
import {
  deleteDocumentById,
  listUploadedDocuments,
  uploadDocumentFromBuffer,
} from "../services/document.service";

const allowedExtensions = new Set([".pdf", ".txt", ".md", ".markdown"]);

function hasAllowedExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return allowedExtensions.has(ext);
}

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!hasAllowedExtension(file.originalname)) {
      cb(new Error("Only PDF, TXT, and Markdown files are supported"));
      return;
    }
    cb(null, true);
  },
});

export const uploadDocumentMiddleware = uploader.single("file");

export async function postUploadDocument(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Use field name 'file'." });
    }

    const uploaded = await uploadDocumentFromBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    return res.status(201).json({ document: uploaded });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload document";
    return res.status(400).json({ error: message });
  }
}

export async function getDocuments(_req: Request, res: Response) {
  try {
    const documents = await listUploadedDocuments();
    return res.status(200).json({ documents });
  } catch (error) {
    console.error("GET /documents failed:", error);
    return res.status(500).json({ error: "Failed to load documents" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const rawDocumentId = req.params.documentId;
    const documentId =
      typeof rawDocumentId === "string"
        ? rawDocumentId
        : (rawDocumentId?.[0] ?? "");
    const deleted = await deleteDocumentById(documentId);
    if (!deleted) {
      return res.status(404).json({ error: "Document not found" });
    }
    return res.sendStatus(204);
  } catch (error) {
    console.error("DELETE /documents/:documentId failed:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
}

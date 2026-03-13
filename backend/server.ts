import "dotenv/config";
import express from "express";
import { connectToDatabase } from "./services/mongodb.service";

import {
  postDocumentChat,
  postGeneralChat,
} from "./controllers/chat.controller";
import {
  deleteDocument,
  getDocuments,
  postUploadDocument,
  uploadDocumentMiddleware,
} from "./controllers/document.controller";
import { createRateLimitMiddleware } from "./middleware/rateLimit.middleware";

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const uploadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

app.use(express.json({ limit: "1mb" }));
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.post("/chat", postDocumentChat);
app.post("/chat/general", postGeneralChat);
app.get("/documents", getDocuments);
app.post(
  "/documents/upload",
  uploadRateLimit,
  uploadDocumentMiddleware,
  postUploadDocument,
);
app.delete("/documents/:documentId", deleteDocument);
app.get("/health", (_, res) => {
  res.status(200).json({ ok: true });
});

app.use((_, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

void startServer();

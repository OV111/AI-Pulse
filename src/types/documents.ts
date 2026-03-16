type ObjectId = string;

export type UploadedDocument = {
  id: string;
  name: string;
  sizeKb: number;
  chunks: number;
  uploadedAt: string;
  status: "processing" | "ready" | "error";
};

export  interface Document {
  _id?: ObjectId;
  name: string;
  originalName: string;
  type: string;
  size: number;
  extractedText: string;
  chunks: string[];
  uploadedAt: Date;
  status: "processing" | "ready" | "error";
  error?: string;
}

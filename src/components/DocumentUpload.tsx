import { useState, type ChangeEvent } from "react";
import {
  FileText,
  MessageSquare,
  PanelLeft,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { UploadedDocument } from "../types/documents";
import { NavLink } from "react-router-dom";

type DocumentUploadProps = {
  documents: UploadedDocument[];
  isLoadingDocuments: boolean;
  onDocumentUploaded: (document: UploadedDocument) => void;
  onDocumentDeleted: (documentId: string) => void;
  onToggleSidebar: () => void;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

function DocumentUpload({
  documents,
  isLoadingDocuments,
  onDocumentUploaded,
  onDocumentDeleted,
  onToggleSidebar,
}: DocumentUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "waking" | "uploading"
  >("idle");
  const [isDeletingDocumentId, setIsDeletingDocumentId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadStatus("idle");
    setErrorMessage(null);
  };

  const uploadSelectedFile = async () => {
    if (uploadStatus !== "idle" || !selectedFile) return;

    setUploadStatus("waking");
    setErrorMessage(null);

    try {
      // Wake up Render service if sleeping — retry until healthy or give up
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const res = await fetch(`${API_BASE_URL}/health`);
          if (res.ok) break;
        } catch (_) {
          // service not ready yet, retry
        }
        await new Promise((r) => setTimeout(r, 5000));
      }

      setUploadStatus("uploading");
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }
      const data = (await response.json()) as {
        document?: UploadedDocument;
        error?: string;
      };
      if (!data.document) {
        throw new Error(data.error || "Upload failed");
      }

      onDocumentUploaded({
        ...data.document,
        uploadedAt: "Just now",
      });
      setSelectedFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setErrorMessage(message);
    } finally {
      setUploadStatus("idle");
    }
  };

  const deleteDocument = async (documentId: string) => {
    if (isDeletingDocumentId) return;

    setIsDeletingDocumentId(documentId);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }
      onDocumentDeleted(documentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed";
      setErrorMessage(message);
    } finally {
      setIsDeletingDocumentId(null);
    }
  };

  return (
    <section className="min-h-screen bg-[#03070f]">
      <header className="flex h-11 items-center gap-2 border-b border-[#0f1f31] px-4 text-xs text-slate-400">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#0d2037] hover:text-slate-200 md:hidden"
          aria-label="Open sidebar"
        >
          <PanelLeft size={12} />
        </button>
        <span className="text-slate-300">Dashboard</span>
      </header>

      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            Upload Documents
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Drop your company handbooks, guides, or policies to enable
            AI-powered Q&A.
          </p>
        </div>

        <label
          htmlFor="document-upload-input"
          className="mb-4 block cursor-pointer rounded-xl border border-dashed border-[#17406a] bg-[#010b16] px-6 py-12 text-center transition hover:border-[#1f5f9d] hover:bg-[#061422]"
        >
          <div className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a2d50] text-[#4ca1ff]">
            <Upload size={14} />
          </div>
          <div className="text-sm font-medium text-slate-200">
            Drop your documents here
          </div>
          <div className="mt-1 text-xs text-slate-500">
            PDF, TXT, or Markdown up to 10MB
          </div>
          <div className="mt-1 text-xs font-medium text-[#3c8de3]">
            Browse files
          </div>
          <input
            id="document-upload-input"
            type="file"
            accept=".pdf,.txt,.md,.markdown"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>

        {selectedFile && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between rounded-lg border border-[#10253b] bg-[#071021] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0a2d50] text-[#4ca1ff]">
                  <FileText size={12} />
                </div>
                <div className="text-xs">
                  <p className="text-slate-200">{selectedFile.name}</p>
                  <p className="text-slate-500">
                    {Math.max(1, Math.round(selectedFile.size / 1024))} kB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedFile}
                disabled={uploadStatus !== "idle"}
                className="text-slate-500 transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </div>

            <div className="h-2 rounded-full bg-[#0a1422]">
              <div
                className={`h-2 rounded-full bg-[#2a90ff] transition-all ${uploadStatus !== "idle" ? "animate-pulse w-full" : "w-0"}`}
              />
            </div>

            <button
              type="button"
              onClick={uploadSelectedFile}
              disabled={uploadStatus !== "idle"}
              className="mt-2 h-7 w-full rounded-md bg-[#2a90ff] text-xs font-medium text-white transition hover:bg-[#3d9cff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadStatus === "waking"
                ? "Connecting to server..."
                : uploadStatus === "uploading"
                  ? "Uploading..."
                  : "Upload 1 file"}
            </button>
          </div>
        )}
        {errorMessage && (
          <p className="mb-3 rounded-md border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </p>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Your Documents
            </h3>
            {!isLoadingDocuments && documents.length > 0 && (
              <span className="text-[10px] text-slate-500">
                {documents.length} document{documents.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {isLoadingDocuments ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-[#10253b] bg-[#071021] px-3 py-2"
                >
                  <div className="h-7 w-7 animate-pulse rounded-md bg-[#0a2d50]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-2/5 animate-pulse rounded bg-[#0d2037]" />
                    <div className="h-2 w-1/3 animate-pulse rounded bg-[#0a1a2e]" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-[#0f1f31] bg-[#010912] px-4 py-14 text-center">
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e2a39] bg-[#101826] text-slate-400">
                <FileText size={14} />
              </div>
              <p className="text-sm font-medium text-slate-300">
                No documents yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Upload a PDF, TXT, or Markdown file to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between rounded-lg border border-[#10253b] bg-[#071021] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0a2d50] text-[#4ca1ff]">
                      <FileText size={13} />
                    </div>
                    <div className="text-xs">
                      <p className="text-slate-200">{document.name}</p>
                      {document.status === "processing" ? (
                        <p className="flex items-center gap-1 text-amber-400">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                          Processing…
                        </p>
                      ) : document.status === "error" ? (
                        <p className="text-red-400">Processing failed</p>
                      ) : (
                        <p className="text-slate-500">
                          <span>{document.uploadedAt}</span>
                          <span className="px-1">•</span>
                          <span>{document.sizeKb} kB</span>
                          <span className="px-1">•</span>
                          <span>{document.chunks} chunks</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    {document.status === "ready" && (
                      <NavLink to={`/chat/${document.id}`}>
                        <MessageSquare size={13} />
                      </NavLink>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteDocument(document.id)}
                      disabled={isDeletingDocumentId === document.id}
                      className="transition hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Delete ${document.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default DocumentUpload;

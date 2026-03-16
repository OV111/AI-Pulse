import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import SideBar from "./components/SideBar";
import Chat from "./components/Chat";
import DocumentUpload from "./components/DocumentUpload";
import type { UploadedDocument } from "./types/documents";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

function App() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        // Wake up Render service if sleeping
        await fetch(`${API_BASE_URL}/health`).catch(() => null);
        const response = await fetch(`${API_BASE_URL}/documents`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          documents?: UploadedDocument[];
        };
        if (Array.isArray(data.documents)) {
          setDocuments(data.documents);
        }
      } catch (error) {
        console.error("Failed to load documents:", error);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    void loadDocuments();

    // Keep Render free-tier service alive (spins down after 15min inactivity)
    const keepAlive = setInterval(() => {
      fetch(`${API_BASE_URL}/health`).catch(() => null);
    }, 10 * 60 * 1000);

    return () => clearInterval(keepAlive);
  }, []);

  const closeSidebar = () => setIsMobileSidebarOpen(false);

  return (
    <main className="min-h-screen bg-[#02050a] text-slate-100">
      <div className="relative min-h-screen w-full md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        {isMobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={closeSidebar}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform md:static md:z-auto md:w-auto md:translate-x-0 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SideBar
            documents={documents}
            isLoadingDocuments={isLoadingDocuments}
            onNavigate={closeSidebar}
          />
        </div>

        <section className="min-h-screen md:border-l md:border-[#0f1f31]">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DocumentUpload
                  documents={documents}
                  isLoadingDocuments={isLoadingDocuments}
                  onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                  onDocumentUploaded={(doc) =>
                    setDocuments((prev) => [
                      doc,
                      ...prev.filter((item) => item.id !== doc.id),
                    ])
                  }
                  onDocumentDeleted={(documentId) =>
                    setDocuments((prev) =>
                      prev.filter((document) => document.id !== documentId),
                    )
                  }
                />
              }
            />
            <Route
              path="/chat"
              element={
                <Chat
                  documents={documents}
                  onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                />
              }
            />
            <Route
              path="/chat/:documentId"
              element={
                <Chat
                  documents={documents}
                  onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                />
              }
            />
          </Routes>
        </section>
      </div>
    </main>
  );
}

export default App;

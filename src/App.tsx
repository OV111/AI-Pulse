import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import SideBar from "./components/SideBar";
import Chat from "./components/Chat";
import DocumentUpload from "./components/DocumentUpload";
import type { UploadedDocument } from "./types/documents";

function App() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#02050a] text-slate-100">
      <div className="relative min-h-screen w-full md:grid md:grid-cols-[260px_1fr]">
        {isMobileSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-40 w-[260px] transform transition-transform md:static md:z-auto md:w-auto md:translate-x-0 ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SideBar
            documents={documents}
            onNavigate={() => setIsMobileSidebarOpen(false)}
          />
        </div>

        <section className="min-h-screen border-l border-[#0f1f31] md:border-l">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <DocumentUpload
                  documents={documents}
                  onToggleSidebar={() => setIsMobileSidebarOpen(true)}
                  onDocumentUploaded={(doc) =>
                    setDocuments((prev) => [
                      doc,
                      ...prev.filter((item) => item.name !== doc.name),
                    ])
                  }
                />
              }
            />
            <Route
              path="/all-documents-chat"
              element={<Chat onToggleSidebar={() => setIsMobileSidebarOpen(true)} />}
            />
          </Routes>
        </section>
      </div>
    </main>
  );
}

export default App;

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { ArrowUp, PanelLeft, Sparkles, User } from "lucide-react";
import useSWRMutation from "swr/mutation";
import type { UploadedDocument } from "../types/documents";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const suggestions = [
  "What documents are available?",
  "Summarize all documents briefly",
  "What are the key policies across all documents?",
  "Are there conflicting details between documents?",
];

type ChatProps = {
  onToggleSidebar: () => void;
  documents: UploadedDocument[];
};

type ChatApiPayload = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  documentId?: string;
};

type ChatApiResponse = {
  message?: { role: "assistant"; content: string };
};

const postChat = async (
  url: string,
  { arg }: { arg: ChatApiPayload },
): Promise<ChatApiResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
};

function Chat({ onToggleSidebar, documents }: ChatProps) {
  const { documentId } = useParams<{ documentId?: string }>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isDocumentChat = Boolean(documentId);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
  // Include documentId in the SWR key so each document gets its own mutation state
  const swrKey = isDocumentChat ? `${API_BASE_URL}/chat#${documentId}` : `${API_BASE_URL}/chat/general`;
  const fetchUrl = isDocumentChat ? `${API_BASE_URL}/chat` : `${API_BASE_URL}/chat/general`;

  const documentName = documentId
    ? (documents.find((d) => d.id === documentId)?.name ?? "Document")
    : null;

  // Reset conversation when switching documents
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [documentId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const { trigger: triggerChat } = useSWRMutation(swrKey, (_key, opts: { arg: ChatApiPayload }) =>
    postChat(fetchUrl, opts),
  );

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || isThinking) return;

    const updatedMessages = [
      ...messages,
      { role: "user" as const, text: content },
    ];
    setMessages(updatedMessages);
    setInput("");
    setIsThinking(true);

    try {
      const payload: ChatApiPayload = {
        messages: updatedMessages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
      };
      if (isDocumentChat) payload.documentId = documentId;

      const data = await triggerChat(payload);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            data.message?.content ??
            "I could not generate a response right now. Try again.",
        },
      ]);
    } catch (error) {
      console.error("Chat request failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Something went wrong while calling the chat API. Please try again.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <section className="flex min-h-screen flex-col bg-[#03070f]">
      <header className="flex h-11 items-center gap-2 border-b border-[#0f1f31] px-4 text-xs text-slate-400">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#0d2037] hover:text-slate-200 md:hidden"
          aria-label="Open sidebar"
        >
          <PanelLeft size={12} />
        </button>

        <span>{documentName ?? "All Documents Chat"}</span>
      </header>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto mt-20 max-w-xl text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a2d50] text-[#4ca1ff]">
              <Sparkles size={16} />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">
              {isDocumentChat
                ? `Chat with ${documentName ?? "this document"}`
                : "Chat with all your documents"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
              {isDocumentChat ? (
                <>
                  Ask questions about{" "}
                  <span className="text-slate-100">
                    {documentName ?? "this document"}
                  </span>
                  . The AI will answer based on its content.
                </>
              ) : (
                <>
                  Ask questions across{" "}
                  <span className="text-slate-100">all uploaded documents.</span>
                  <br />
                  The AI will search through everything and cross-reference
                  information for you.
                </>
              )}
            </p>

            {!isDocumentChat && (
              <div className="mx-auto mt-5 grid max-w-[460px] grid-cols-1 gap-2 text-left sm:grid-cols-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void sendMessage(item)}
                    className="rounded-xl border border-[#1a2c41] bg-[#071021] px-3 py-2 text-xs text-slate-400 transition hover:border-[#28507e] hover:text-slate-300"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full space-y-4">
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={`user-${index}`} className="flex justify-end gap-1.5">
                  <div className="max-w-[70%] rounded-xl bg-[#2a90ff] px-3 py-2 text-xs text-white">
                    {message.text}
                  </div>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1a2c41] bg-[#0e1724] text-slate-400">
                    <User size={11} />
                  </div>
                </div>
              ) : (
                <div key={`assistant-${index}`} className="max-w-[80%]">
                  <div className="rounded-xl border border-[#1a2c41] bg-[#0b1626] px-3 py-2 text-xs text-slate-200">
                    {message.text}
                  </div>
                </div>
              ),
            )}

            {isThinking && (
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0b3259] text-[#4ca1ff]">
                  <Sparkles size={10} />
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-[#121f30] px-2 py-1 text-slate-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:180ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:320ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[#0f1f31] bg-[#040912] px-3 pb-2 pt-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="mx-auto flex w-full max-w-6xl items-center gap-2 rounded-xl border border-[#10253b] bg-[#030f1d] px-2 py-1.5"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            type="text"
            placeholder={
              isDocumentChat
                ? `Ask a question about ${documentName ?? "this document"}...`
                : "Ask a question across all your documents..."
            }
            className="h-8 flex-1 bg-transparent px-1 text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0c4d9b] text-[#b9d9ff] transition hover:bg-[#1366c7] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUp size={13} />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[12px] text-slate-600">
          AI responses are generated from uploaded documents. Always verify
          important information.
        </p>
      </div>
    </section>
  );
}

export default Chat;

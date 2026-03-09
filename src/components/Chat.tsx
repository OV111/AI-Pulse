import { useMemo, useState } from "react";
import { ArrowUp, PanelLeft, Sparkles } from "lucide-react";

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
};

function Chat({ onToggleSidebar }: ChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const hasMessages = messages.length > 0;
  const headerLabel = useMemo(
    () => (hasMessages ? "Express.js" : "All Documents Chat"),
    [hasMessages],
  );
  const badgeLabel = useMemo(
    () => (hasMessages ? "4 chunks" : "1 document"),
    [hasMessages],
  );

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content) return;

    setMessages((prev) => [...prev, { role: "user", text: content }]);
    setInput("");
    setIsThinking(true);
  };

  return (
    <section className="flex h-screen max-h-screen flex-col bg-[#03070f]">
      <header className="flex h-11 items-center gap-2 border-b border-[#0f1f31] px-4 text-xs text-slate-400">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#0d2037] hover:text-slate-200 md:hidden"
          aria-label="Open sidebar"
        >
          <PanelLeft size={12} />
        </button>
        <span className="text-slate-300">{headerLabel}</span>
        <span className="rounded-md border border-[#1e2f44] bg-[#0d1522] px-1.5 py-0.5 text-[10px] text-slate-400">
          {badgeLabel}
        </span>
      </header>

      <div className="relative flex-1 overflow-y-auto px-4 py-5">
        {!hasMessages ? (
          <div className="mx-auto mt-20 max-w-xl text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a2d50] text-[#4ca1ff]">
              <Sparkles size={16} />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">
              Chat with all your documents
            </h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
              Ask questions across{" "}
              <span className="text-slate-100">all uploaded documents.</span>
              <br />
              The AI will search through everything and cross-reference
              information for you.
            </p>

            <div className="mx-auto mt-5 grid max-w-[460px] grid-cols-1 gap-2 text-left sm:grid-cols-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendMessage(item)}
                  className="rounded-xl border border-[#1a2c41] bg-[#071021] px-3 py-2 text-xs text-slate-400 transition hover:border-[#28507e] hover:text-slate-300"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end gap-1.5">
              <div className="max-w-[70%] rounded-xl bg-[#2a90ff] px-3 py-2 text-xs text-white">
                {messages[messages.length - 1].text}
              </div>
              <button
                type="button"
                className="h-6 w-6 rounded-full border border-[#1a2c41] bg-[#0e1724] text-slate-400"
              >
                ?
              </button>
            </div>

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
          </div>
        )}
      </div>

      <div className="border-t border-[#0f1f31] bg-[#040912] px-3 pb-2 pt-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2 rounded-xl border border-[#10253b] bg-[#030f1d] px-2 py-1.5"
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            type="text"
            placeholder={
              hasMessages
                ? "Ask a question about this document..."
                : "Ask a question across all your documents..."
            }
            className="h-8 flex-1 bg-transparent px-1 text-xs text-slate-200 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0c4d9b] text-[#b9d9ff] transition hover:bg-[#1366c7]"
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

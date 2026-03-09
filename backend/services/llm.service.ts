import Groq from "groq-sdk";
import type { ChatMessage } from "../types/chat";

type GenerateReplyInput = {
  messages: ChatMessage[];
  mode: "document" | "general";
  documentId?: string;
};

const groqClient = process.env.GROQ_KEY
  ? new Groq({ apiKey: process.env.GROQ_KEY })
  : null;

const BASE_SYSTEM_PROMPT = `
You are a helpful, intelligent, and friendly AI assistant.

Your goals:
- Provide clear, accurate, and helpful answers.
- Explain complex topics in a simple and understandable way.
- Use structured responses when helpful (lists, steps, short paragraphs).
- Be concise but informative.

Guidelines:
- If you are unsure about something, say so honestly.
- Do not invent facts.
- When explaining technical topics, include practical examples.
- Maintain a professional and respectful tone.

Always prioritize clarity, usefulness, and accuracy in your responses.
`;

export async function generateAssistantReply(
  input: GenerateReplyInput,
): Promise<string> {
  const { messages, mode, documentId } = input;
  const latestUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user")?.content;

  if (!latestUserMessage) {
    return "I did not receive a user question.";
  }

  if (!groqClient) {
    const scopeText =
      mode === "general"
        ? "all uploaded documents"
        : `document ${documentId ?? "unknown"}`;
    return `I received your question about ${scopeText}: "${latestUserMessage}". LLM provider is not configured yet, so this is a placeholder response.`;
  }

  const scopePrompt =
    mode === "general"
      ? "Scope: All uploaded documents."
      : `Scope: Document ID ${documentId ?? "unknown"}.`;

  try { 
    const completion = await groqClient.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        { role: "system", content: `${BASE_SYSTEM_PROMPT} ${scopePrompt}` },
        ...messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || "No response.";
  } catch (error) {
    console.error("Groq generation failed:", error);
    return "I could not generate a response right now. Please try again.";
  }
}

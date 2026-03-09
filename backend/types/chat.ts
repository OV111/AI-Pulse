export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface DocumentChatRequestBody {
  documentId: string;
  messages: ChatMessage[];
}

export interface GeneralChatRequestBody {
  messages: ChatMessage[];
}

export interface ChatResponseBody {
  message: ChatMessage;
}

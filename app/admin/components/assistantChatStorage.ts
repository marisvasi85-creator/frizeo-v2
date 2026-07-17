export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "frizeo-assistant-chat-v1";
const MAX_STORED_MESSAGES = 40;

type StoredChat = {
  messages: AssistantChatMessage[];
  input?: string;
  updatedAt: number;
};

function isMessage(value: unknown): value is AssistantChatMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string"
  );
}

export function buildWelcomeMessage(displayName: string): string {
  return `Salut${displayName ? `, ${displayName}` : ""}! Sunt Frizeo Assistant.\n\nPot să-ți spun ce ai azi / cine urmează, să mut sau anulez programări, să adaug servicii, sau să setez zi liberă / concediu (cu confirmare). Prețul e opțional. Nu calculez încasări.`;
}

export function loadAssistantChat(displayName: string): {
  messages: AssistantChatMessage[];
  input: string;
} {
  const welcome: AssistantChatMessage = {
    id: "welcome",
    role: "assistant",
    content: buildWelcomeMessage(displayName),
  };

  if (typeof window === "undefined") {
    return { messages: [welcome], input: "" };
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [welcome], input: "" };

    const parsed = JSON.parse(raw) as Partial<StoredChat>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(isMessage).slice(-MAX_STORED_MESSAGES)
      : [];

    if (messages.length === 0) {
      return { messages: [welcome], input: "" };
    }

    return {
      messages,
      input: typeof parsed.input === "string" ? parsed.input : "",
    };
  } catch {
    return { messages: [welcome], input: "" };
  }
}

export function saveAssistantChat(
  messages: AssistantChatMessage[],
  input: string,
) {
  if (typeof window === "undefined") return;

  try {
    const payload: StoredChat = {
      messages: messages.slice(-MAX_STORED_MESSAGES),
      input,
      updatedAt: Date.now(),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode failures
  }
}

export function clearAssistantChat() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

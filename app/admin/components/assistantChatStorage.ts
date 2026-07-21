export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_STORAGE_KEY = "frizeo-assistant-chat-v1";
const MAX_STORED_MESSAGES = 40;

type StoredChat = {
  messages: AssistantChatMessage[];
  input?: string;
  updatedAt: number;
};

function storageKeyFor(namespace?: string) {
  if (!namespace || namespace === "salon") return DEFAULT_STORAGE_KEY;
  return `frizeo-assistant-chat-${namespace}-v1`;
}

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

export function buildPlatformWelcomeMessage(): string {
  return `Salut, Maris! Sunt Platform Assistant — doar pentru tine.\n\nPoți cere briefing, health, follow-up pe email (cu confirmare), note, plan/trial, sau ștergere salon (confirmare + slug). Nu încasează bani în Stripe.`;
}

export function loadAssistantChat(
  displayName: string,
  options?: { namespace?: string; welcome?: string },
): {
  messages: AssistantChatMessage[];
  input: string;
} {
  const welcome: AssistantChatMessage = {
    id: "welcome",
    role: "assistant",
    content: options?.welcome || buildWelcomeMessage(displayName),
  };

  if (typeof window === "undefined") {
    return { messages: [welcome], input: "" };
  }

  try {
    const raw = window.sessionStorage.getItem(storageKeyFor(options?.namespace));
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
  namespace?: string,
) {
  if (typeof window === "undefined") return;

  try {
    const payload: StoredChat = {
      messages: messages.slice(-MAX_STORED_MESSAGES),
      input,
      updatedAt: Date.now(),
    };
    window.sessionStorage.setItem(
      storageKeyFor(namespace),
      JSON.stringify(payload),
    );
  } catch {
    // ignore quota / private mode failures
  }
}

export function clearAssistantChat(namespace?: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKeyFor(namespace));
  } catch {
    // ignore
  }
}

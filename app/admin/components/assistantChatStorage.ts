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
  return `Salut${displayName ? `, ${displayName}` : ""}! Sunt Frizeo Assistant.\n\nPot să-ți spun ce ai azi, să caut programări (și după telefon), să mut/anulez, să dau link-ul de programare, să schimb programul L–D sau un serviciu, să invit un frizer, și să-ți explic cum funcționează SMS, Google Calendar și restul din admin. Acțiunile importante cer Confirmă / Renunță. Prețul e opțional. Nu calculez încasări.`;
}

export function buildPlatformWelcomeMessage(): string {
  return `Salut, Maris! Sunt Growth Assistant — doar pentru tine.\n\nÎntreabă-mă cum stăm, unde pierdem oameni, cine e inactiv, ce trebuie să faci azi, sau cine merită un review (îți dau draft, nu trimit). Rămân și ops: briefing, health, plan/trial, SMS, ștergere salon. Nu încasează bani în Stripe.`;
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechDictation } from "./useSpeechDictation";
import {
  buildWelcomeMessage,
  clearAssistantChat,
  loadAssistantChat,
  saveAssistantChat,
  type AssistantChatMessage,
} from "./assistantChatStorage";

export type { AssistantChatMessage };
export { buildWelcomeMessage };

const DEFAULT_SUGGESTIONS = [
  "Ce am azi?",
  "Cine e următorul client?",
  "Ce frizeri avem?",
  "Închide mâine (zi liberă)",
  "Ce concedii am?",
  "Ce programări am mâine?",
];

type PendingConfirmation = {
  id: string;
  action: string;
  summary: string;
  proposal?: unknown;
  expiresAt: number;
};

type AssistantChatPanelProps = {
  configured: boolean;
  displayName: string;
  compact?: boolean;
  suggestions?: string[];
  className?: string;
  apiPath?: string;
  confirmApiPath?: string;
  storageNamespace?: string;
  welcomeMessage?: string;
};

function resolveConfirmPath(apiPath: string, confirmApiPath?: string) {
  if (confirmApiPath) return confirmApiPath;
  if (apiPath.endsWith("/chat")) {
    return `${apiPath.slice(0, -"/chat".length)}/confirm`;
  }
  return `${apiPath.replace(/\/$/, "")}/confirm`;
}

export default function AssistantChatPanel({
  configured,
  displayName,
  compact = false,
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
  apiPath = "/api/assistant/chat",
  confirmApiPath,
  storageNamespace = "salon",
  welcomeMessage,
}: AssistantChatPanelProps) {
  const confirmPath = resolveConfirmPath(apiPath, confirmApiPath);
  const [boot] = useState(() =>
    loadAssistantChat(displayName, {
      namespace: storageNamespace,
      welcome: welcomeMessage,
    }),
  );
  const [messages, setMessages] = useState<AssistantChatMessage[]>(
    () => boot.messages,
  );
  const [input, setInput] = useState(() => boot.input);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const baseInputRef = useRef(boot.input);
  const hydratedRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveAssistantChat(messages, input, storageNamespace);
  }, [messages, input, storageNamespace]);

  const handleTranscript = useCallback(
    ({ committed, interim: live }: { committed: string; interim: string }) => {
      const base = baseInputRef.current.trim();
      const dictated = committed.trim();
      const next = [base, dictated].filter(Boolean).join(" ");
      setInput(next);
      setInterim(live);
    },
    [],
  );

  const dictation = useSpeechDictation({
    lang: "ro-RO",
    onTranscript: handleTranscript,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingConfirmation]);

  useEffect(() => {
    if (!dictation.listening) {
      setInterim("");
    }
  }, [dictation.listening]);

  function composeCurrentText() {
    const live = interim.trim();
    if (!live) return input;
    return `${input.trim()}${input.trim() ? " " : ""}${live}`;
  }

  function resetConversation() {
    if (dictation.listening) dictation.stop();
    clearAssistantChat(storageNamespace);
    const welcome: AssistantChatMessage = {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage || buildWelcomeMessage(displayName),
    };
    setMessages([welcome]);
    setInput("");
    baseInputRef.current = "";
    setInterim("");
    setError(null);
    setPendingConfirmation(null);
  }

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;

    if (dictation.listening) {
      dictation.stop();
    }

    setError(null);
    setPendingConfirmation(null);
    setInput("");
    baseInputRef.current = "";
    setInterim("");

    const userMessage: AssistantChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        pendingConfirmation?: PendingConfirmation | null;
      };

      if (!res.ok) {
        throw new Error(data.error || "Nu am putut răspunde acum.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "Nu am un răspuns momentan.",
        },
      ]);
      setPendingConfirmation(data.pendingConfirmation ?? null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Eroare la Assistant";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Nu am putut răspunde: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmation(accept: boolean) {
    if (!pendingConfirmation || loading) return;

    setLoading(true);
    setError(null);
    const confirmationId = pendingConfirmation.id;
    setPendingConfirmation(null);

    setMessages((prev) => [
      ...prev,
      {
        id: `u-confirm-${Date.now()}`,
        role: "user",
        content: accept ? "Confirmă" : "Renunță",
      },
    ]);

    try {
      const res = await fetch(confirmPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId, accept }),
      });

      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        pendingConfirmation?: PendingConfirmation | null;
      };

      if (!res.ok) {
        throw new Error(data.error || "Nu am putut confirma acțiunea.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-confirm-${Date.now()}`,
          role: "assistant",
          content: data.reply || (accept ? "Gata." : "Am renunțat."),
        },
      ]);
      setPendingConfirmation(data.pendingConfirmation ?? null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Eroare la confirmare";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-confirm-${Date.now()}`,
          role: "assistant",
          content: `Nu am putut finaliza: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const displayValue = composeCurrentText();
  const canClear = messages.some((m) => m.id !== "welcome");
  const inputLocked = loading || !configured || Boolean(pendingConfirmation);

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {!configured && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Setează <code>OPENAI_API_KEY</code> sau <code>GEMINI_API_KEY</code> pe
          staging ca să răspundă.
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 p-3 md:p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-frz-ink text-frz-ink-contrast"
                  : "bg-frz-fog border border-frz-line text-frz-ink/90"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {pendingConfirmation && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 space-y-3">
            <p className="text-xs text-amber-100/80">
              Confirmare necesară — acțiunea nu s-a aplicat încă.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleConfirmation(true)}
                className="rounded-lg bg-frz-ink text-frz-fog px-3.5 py-2 text-sm font-medium disabled:opacity-40"
              >
                Confirmă
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleConfirmation(false)}
                className="rounded-lg border border-frz-line bg-frz-card text-frz-ink px-3.5 py-2 text-sm disabled:opacity-40"
              >
                Renunță
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-sm text-frz-ink/50">Assistant-ul gândește…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-frz-line p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {suggestions
              .slice(0, compact ? 3 : suggestions.length)
              .map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={inputLocked}
                  onClick={() => sendMessage(suggestion)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-frz-line text-frz-ink/70 hover:bg-frz-fog disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
          </div>

          {canClear && (
            <button
              type="button"
              onClick={resetConversation}
              className="shrink-0 text-[11px] text-frz-ink/40 hover:text-frz-ink/70 px-1"
              title="Șterge conversația"
            >
              Șterge
            </button>
          )}
        </div>

        {dictation.listening && (
          <div className="text-[11px] text-red-600 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Ascult… oprește-se singur după ce termini, sau apasă microfonul
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(composeCurrentText());
          }}
        >
          <input
            value={displayValue}
            onChange={(e) => {
              if (dictation.listening) return;
              setInput(e.target.value);
              baseInputRef.current = e.target.value;
            }}
            disabled={inputLocked}
            readOnly={dictation.listening}
            placeholder={
              pendingConfirmation
                ? "Confirmă sau renunță mai sus…"
                : dictation.listening
                  ? "Vorbește acum…"
                  : "Scrie sau dictează…"
            }
            className="flex-1 rounded-xl bg-frz-card border border-frz-line px-3 py-2.5 text-sm text-frz-ink outline-none focus:border-frz-ink/30 disabled:opacity-50 placeholder:text-frz-ink/40"
          />

          {dictation.supported && (
            <button
              type="button"
              disabled={inputLocked}
              onClick={() => {
                dictation.clearError();
                if (!dictation.listening) {
                  baseInputRef.current = input;
                  setInterim("");
                }
                dictation.toggle();
              }}
              aria-label={
                dictation.listening ? "Oprește dictarea" : "Pornește dictarea"
              }
              title={
                dictation.listening ? "Oprește dictarea" : "Dictează cu vocea"
              }
              className={`h-11 w-11 shrink-0 rounded-xl border text-lg flex items-center justify-center transition disabled:opacity-40 ${
                dictation.listening
                  ? "bg-red-500 text-white border-red-400 animate-pulse"
                  : "bg-frz-fog text-frz-ink border-frz-line hover:bg-frz-fog"
              }`}
            >
              🎤
            </button>
          )}

          <button
            type="submit"
            disabled={inputLocked || !composeCurrentText().trim()}
            className="rounded-xl bg-frz-ink text-frz-fog px-3.5 py-2.5 text-sm font-medium disabled:opacity-40 shrink-0"
          >
            Trimite
          </button>
        </form>

        {(error || dictation.error) && (
          <p className="text-xs text-red-300">{error || dictation.error}</p>
        )}

        {!dictation.supported && (
          <p className="text-[11px] text-frz-ink/40">
            Dictarea nu e disponibilă pe acest browser. Folosește Chrome pe
            Android sau desktop.
          </p>
        )}
      </div>
    </div>
  );
}

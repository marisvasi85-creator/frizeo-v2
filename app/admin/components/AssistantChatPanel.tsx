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
  "Închide mâine (zi liberă)",
  "Ce programări am mâine?",
  "Adaugă un serviciu de 60 de minute",
];

type AssistantChatPanelProps = {
  configured: boolean;
  displayName: string;
  compact?: boolean;
  suggestions?: string[];
  className?: string;
  apiPath?: string;
  storageNamespace?: string;
  welcomeMessage?: string;
  /** Extra JSON fields merged into the chat POST body (e.g. salonSlug). */
  requestExtra?: Record<string, unknown>;
  appearance?: "dark" | "light";
  titleLoading?: string;
};

export default function AssistantChatPanel({
  configured,
  displayName,
  compact = false,
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
  apiPath = "/api/assistant/chat",
  storageNamespace = "salon",
  welcomeMessage,
  requestExtra,
  appearance = "dark",
}: AssistantChatPanelProps) {
  const light = appearance === "light";
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
  }, [messages, loading]);

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
  }

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;

    if (dictation.listening) {
      dictation.stop();
    }

    setError(null);
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
          ...(requestExtra || {}),
          messages: nextMessages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };

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

  const displayValue = composeCurrentText();
  const canClear = messages.some((m) => m.id !== "welcome");

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {!configured && (
        <div
          className={`mx-3 mt-3 rounded-xl border px-3 py-2 text-xs ${
            light
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-amber-500/30 bg-amber-500/10 text-amber-100"
          }`}
        >
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
                  ? light
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-black"
                  : light
                    ? "bg-neutral-100 border border-neutral-200 text-neutral-800"
                    : "bg-white/5 border border-white/10 text-white/90"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div
            className={`text-sm ${light ? "text-neutral-500" : "text-white/50"}`}
          >
            Assistant-ul gândește…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={`border-t p-3 space-y-2.5 ${
          light ? "border-neutral-200" : "border-white/10"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {suggestions
              .slice(0, compact ? 3 : suggestions.length)
              .map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={loading || !configured}
                  onClick={() => sendMessage(suggestion)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border disabled:opacity-40 ${
                    light
                      ? "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      : "border-white/10 text-white/70 hover:bg-white/5"
                  }`}
                >
                  {suggestion}
                </button>
              ))}
          </div>

          {canClear && (
            <button
              type="button"
              onClick={resetConversation}
              className={`shrink-0 text-[11px] px-1 ${
                light
                  ? "text-neutral-400 hover:text-neutral-700"
                  : "text-white/40 hover:text-white/70"
              }`}
              title="Șterge conversația"
            >
              Șterge
            </button>
          )}
        </div>

        {dictation.listening && (
          <div
            className={`text-[11px] flex items-center gap-1.5 ${
              light ? "text-red-600" : "text-red-300"
            }`}
          >
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
            disabled={loading || !configured}
            readOnly={dictation.listening}
            placeholder={
              dictation.listening ? "Vorbește acum…" : "Scrie sau dictează…"
            }
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
              light
                ? "bg-white border-neutral-200 text-neutral-900 focus:border-neutral-400"
                : "bg-[#0F0F10] border-white/10 focus:border-white/30"
            }`}
          />

          {dictation.supported && (
            <button
              type="button"
              disabled={loading || !configured}
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
                  : light
                    ? "bg-neutral-50 text-neutral-800 border-neutral-200 hover:bg-neutral-100"
                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"
              }`}
            >
              🎤
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !configured || !composeCurrentText().trim()}
            className={`rounded-xl px-3.5 py-2.5 text-sm font-medium disabled:opacity-40 shrink-0 ${
              light
                ? "bg-neutral-900 text-white"
                : "bg-white text-black"
            }`}
          >
            Trimite
          </button>
        </form>

        {(error || dictation.error) && (
          <p className={`text-xs ${light ? "text-red-600" : "text-red-300"}`}>
            {error || dictation.error}
          </p>
        )}

        {!dictation.supported && (
          <p
            className={`text-[11px] ${
              light ? "text-neutral-400" : "text-white/40"
            }`}
          >
            Dictarea nu e disponibilă pe acest browser. Folosește Chrome pe
            Android sau desktop.
          </p>
        )}
      </div>
    </div>
  );
}

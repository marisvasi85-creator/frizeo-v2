"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechDictation } from "./useSpeechDictation";

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_SUGGESTIONS = [
  "Ce programări am azi?",
  "Ce programări am mâine?",
  "Adaugă un serviciu de 60 de minute",
  "Care sunt cele mai populare servicii?",
  "Ce plan Frizeo am?",
];

export function buildWelcomeMessage(displayName: string): string {
  return `Salut${displayName ? `, ${displayName}` : ""}! Sunt Frizeo Assistant.\n\nPot să-ți arăt programările și serviciile, să adaug un serviciu sau să mut/anulez o programare (cu confirmare). Prețul e opțional. Nu calculez încasări.`;
}

type AssistantChatPanelProps = {
  configured: boolean;
  displayName: string;
  compact?: boolean;
  suggestions?: string[];
  className?: string;
};

export default function AssistantChatPanel({
  configured,
  displayName,
  compact = false,
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
}: AssistantChatPanelProps) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: buildWelcomeMessage(displayName),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const baseInputRef = useRef("");

  const appendFinalTranscript = useCallback((text: string) => {
    setInput((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${text}` : text;
      baseInputRef.current = next;
      return next;
    });
    setInterim("");
  }, []);

  const dictation = useSpeechDictation({
    lang: "ro-RO",
    onFinalTranscript: appendFinalTranscript,
    onInterimTranscript: setInterim,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!dictation.listening) {
      setInterim("");
    }
  }, [dictation.listening]);

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
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        err instanceof Error ? err.message : "Eroare la Frizeo Assistant";
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

  const displayValue =
    dictation.listening && interim
      ? `${input}${input.trim() ? " " : ""}${interim}`
      : input;

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
                  ? "bg-white text-black"
                  : "bg-white/5 border border-white/10 text-white/90"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="text-sm text-white/50">Assistant-ul gândește…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 p-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .slice(0, compact ? 3 : suggestions.length)
            .map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading || !configured}
                onClick={() => sendMessage(suggestion)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
              >
                {suggestion}
              </button>
            ))}
        </div>

        {dictation.listening && (
          <div className="text-[11px] text-red-300 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            Ascult… apeasă din nou pe microfon ca să oprești
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(
              dictation.listening && interim
                ? `${input}${input.trim() ? " " : ""}${interim}`
                : input,
            );
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
            className="flex-1 rounded-xl bg-[#0F0F10] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-white/30 disabled:opacity-50"
          />

          {dictation.supported && (
            <button
              type="button"
              disabled={loading || !configured}
              onClick={() => {
                dictation.clearError();
                if (!dictation.listening) {
                  baseInputRef.current = input;
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
                  : "bg-white/5 text-white border-white/10 hover:bg-white/10"
              }`}
            >
              🎤
            </button>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !configured ||
              !(dictation.listening && interim ? interim : input).trim()
            }
            className="rounded-xl bg-white text-black px-3.5 py-2.5 text-sm font-medium disabled:opacity-40 shrink-0"
          >
            Trimite
          </button>
        </form>

        {(error || dictation.error) && (
          <p className="text-xs text-red-300">{error || dictation.error}</p>
        )}

        {!dictation.supported && (
          <p className="text-[11px] text-white/40">
            Dictarea nu e disponibilă pe acest browser. Folosește Chrome pe
            Android sau desktop.
          </p>
        )}
      </div>
    </div>
  );
}

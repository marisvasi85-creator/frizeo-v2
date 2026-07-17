"use client";

import { useEffect, useRef, useState } from "react";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;

    setError(null);
    setInput("");

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
          {suggestions.slice(0, compact ? 3 : suggestions.length).map((suggestion) => (
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

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || !configured}
            placeholder="Scrie aici…"
            className="flex-1 rounded-xl bg-[#0F0F10] border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !configured || !input.trim()}
            className="rounded-xl bg-white text-black px-3.5 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Trimite
          </button>
        </form>

        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}

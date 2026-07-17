"use client";

import { useEffect, useRef, useState } from "react";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Ce programări am azi?",
  "Ce programări am mâine?",
  "Care sunt serviciile mele?",
  "Care sunt cele mai populare servicii?",
  "Ce plan Frizeo am?",
];

export default function AssistantClient({
  configured,
  displayName,
}: {
  configured: boolean;
  displayName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Salut${displayName ? `, ${displayName}` : ""}! Sunt Frizeo Assistant.\n\nPot să-ți arăt programările, serviciile, popularitatea serviciilor și statusul abonamentului. Încă nu pot muta programări sau calcula încasări.`,
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

    const userMessage: ChatMessage = {
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
    <div className="space-y-4">
      {!configured && (
        <AdminCard className="border-amber-500/30 bg-amber-500/10">
          <p className="text-sm text-amber-100">
            Assistant-ul are nevoie de <code>OPENAI_API_KEY</code> sau{" "}
            <code>GEMINI_API_KEY</code> pe staging ca să răspundă.
          </p>
        </AdminCard>
      )}

      <div className="flex flex-col min-h-[60vh] max-h-[75vh] overflow-hidden rounded-xl border border-white/10 bg-[#161618]">
        <div className="flex-1 overflow-y-auto space-y-3 p-4 md:p-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[90%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
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

        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading || !configured}
                onClick={() => sendMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
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
              placeholder="Ex: Ce programări am azi?"
              className="flex-1 rounded-xl bg-[#0F0F10] border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/30 disabled:opacity-50"
            />
            <AdminButton
              type="submit"
              disabled={loading || !configured || !input.trim()}
            >
              Trimite
            </AdminButton>
          </form>

          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}

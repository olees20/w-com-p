"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function AssistantChat({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || loading) {
      return;
    }

    setError(null);
    setLoading(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed })
      });

      const data = (await res.json()) as { answer?: string; error?: string };

      if (!res.ok || !data.answer) {
        setError(data.error || "Could not get assistant response.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.answer as string }]);
    } catch {
      setError("Network error while contacting assistant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This is guidance only and not legal advice.
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {messages.length ? (
            messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={
                  msg.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-brand-600 px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[85%] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                }
              >
                {msg.content}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">Ask a question about your compliance position to get started.</p>
          )}
        </div>

        <form onSubmit={sendMessage} className="mt-4 space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask: Am I compliant? What should I fix first?"
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Thinking..." : "Send"}
          </Button>
        </form>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Suggested questions</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Am I compliant?</li>
          <li>What am I missing?</li>
          <li>What should I fix first?</li>
          <li>Do I need food waste records?</li>
        </ul>
      </aside>
    </div>
  );
}

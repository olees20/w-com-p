"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const prompts = ["What am I missing?", "What should I fix first?", "Do I need food waste records?", "Am I compliant right now?"];

export function AssistantChat({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

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
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <section className="app-panel p-5">
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This is guidance only and not legal advice.
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {prompts.map((p) => (
            <button key={p} onClick={() => send(p)} className="rounded-full bg-[#eef4f1] px-3 py-1.5 text-sm font-semibold text-[#27473d]" type="button">
              {p}
            </button>
          ))}
        </div>

        <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
          {messages.length ? (
            messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={msg.role === "user" ? "ml-auto max-w-[88%] rounded-xl bg-[#0f5b46] px-4 py-3 text-sm text-white" : "mr-auto max-w-[88%] rounded-xl border border-[#dce6e2] bg-[#f8fbfa] px-4 py-3 text-sm text-[#213f36]"}
              >
                {msg.content}
              </div>
            ))
          ) : (
            <p className="text-sm text-[#5f746d]">Ask a question about your compliance position to get started.</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="mt-4 space-y-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask another question..."
            className="min-h-24 w-full rounded-lg border border-[#d3e2dc] bg-white px-3 py-2 text-sm text-[#123026] placeholder:text-[#7b9089] focus:border-[#0f5b46] focus:outline-none"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Thinking..." : "Send"}
          </Button>
        </form>
      </section>

      <aside className="app-panel p-5">
        <h2 className="text-sm font-bold text-[#1e3d34]">Suggested workflow</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#5f746d]">
          <li>1. Ask what you are missing</li>
          <li>2. Ask what is highest risk</li>
          <li>3. Resolve related alerts</li>
          <li>4. Re-check your compliance score</li>
        </ul>
      </aside>
    </div>
  );
}

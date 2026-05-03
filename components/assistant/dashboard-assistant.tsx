"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function DashboardAssistant({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q })
      });

      const data = (await res.json()) as { answer?: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer ?? "No response available." }]);
    } finally {
      setLoading(false);
    }
  }

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <section className="app-panel p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#111827]">Ask Waste Compliance Monitor Assistant</p>
          <p className="text-sm text-[#6B7280]">Get instant answers about your waste compliance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Am I compliant?", "What am I missing?", "Do I need food waste records?", "What should I fix first?"].map((q) => (
            <button key={q} onClick={() => ask(q)} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-semibold text-[#1E3A8A]" type="button">
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask another question..."
          className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
        />
        <Button type="button" disabled={loading} onClick={() => ask(input)}>
          {loading ? "Thinking..." : "Ask"}
        </Button>
      </div>

      <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm text-[#374151]">
        {latestAssistant?.content ?? "No responses yet."}
      </div>
    </section>
  );
}

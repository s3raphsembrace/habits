"use client";

import { FormEvent, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "How do I lower my sleep debt?",
  "Should I nap today?",
  "Why am I tired in the afternoon?",
];

export default function CoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages(history);
    setBusy(true);

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // API caps history at 12 messages
      body: JSON.stringify({ messages: history.slice(-12) }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "The coach is unavailable right now.");
      return;
    }
    const body = await res.json();
    setOffline(Boolean(body.offline));
    setMessages([...history, { role: "assistant", content: body.reply }]);
    // Scroll to the newest reply after render
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="card coach-card">
      <p className="muted">
        Ask about your sleep — answers are grounded in your logged data and today&apos;s journal.
        Educational guidance, not medical advice.
      </p>

      {messages.length === 0 && (
        <div className="coach-starters">
          {STARTERS.map((s) => (
            <button key={s} className="button" onClick={() => send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="coach-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`coach-bubble coach-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="coach-bubble coach-assistant muted">Thinking…</div>}
        </div>
      )}

      {offline && (
        <p className="form-notice">
          Running without an AI key — set GEMINI_API_KEY to enable conversational answers.
        </p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <form onSubmit={onSubmit} className="coach-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach…"
          maxLength={1000}
          aria-label="Ask the sleep coach"
        />
        <button className="button primary" type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

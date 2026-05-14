"use client";
import { useEffect, useState, useRef } from "react";

interface Message { id: number; channel: string; player_id: number; player_name: string; avatar_color: string; content: string; created_at: string; }
interface Player { id: number; name: string; avatar_color: string; }

const CHANNELS = ["general", "estrategias", "disponibilidad", "off-topic"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [channel, setChannel] = useState("general");
  const [input, setInput] = useState("");
  const [activePlayer, setActivePlayer] = useState<number>(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(d => { setPlayers(d.players || []); if (d.players?.[0]) setActivePlayer(d.players[0].id); });
  }, []);

  const loadMessages = async () => {
    const res = await fetch(`/api/chat?channel=${channel}&limit=100`);
    const d = await res.json();
    setMessages(d.messages || []);
  };

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, player_id: activePlayer, content: input.trim() }) });
    setInput("");
    loadMessages();
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>💬 Chat</h2>
            <p>Comunicación del equipo</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Como:</span>
            <select value={activePlayer} onChange={e => setActivePlayer(Number(e.target.value))} style={{ width: "auto", fontSize: 13, padding: "6px 10px" }}>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="channel-tabs">
          {CHANNELS.map(c => (
            <button key={c} className={`channel-tab ${channel === c ? "active" : ""}`} onClick={() => setChannel(c)}>
              # {c}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-container" style={{ margin: "0 32px" }}>
        <div className="chat-messages">
          {messages.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
              No hay mensajes en #{channel}. ¡Sé el primero!
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className="chat-message">
              <div className="chat-avatar" style={{ background: m.avatar_color, color: "#fff" }}>
                {m.player_name?.[0] || "?"}
              </div>
              <div>
                <div className="chat-msg-header">
                  <span className="chat-msg-name" style={{ color: m.avatar_color }}>{m.player_name}</span>
                  <span className="chat-msg-time">{formatTime(m.created_at)}</span>
                </div>
                <div className="chat-msg-content">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-bar">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Mensaje en #${channel}...`} />
          <button className="btn btn-primary" onClick={send}>Enviar</button>
        </div>
      </div>
    </>
  );
}

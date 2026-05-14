"use client";
import { useEffect, useState, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "next-auth/react";

interface Message { id: number; channel: string; player_id: number; player_name: string; avatar_color: string; content: string; created_at: string; }

const CHANNELS = ["general", "estrategias", "disponibilidad", "off-topic"];

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState("general");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    const res = await fetch(`/api/chat?channel=${channel}&limit=100`);
    const d = await res.json();
    setMessages(d.messages || []);
  };

  useEffect(() => {
    loadMessages();

    if (isSupabaseConfigured) {
      const subscription = supabase
        .channel(`chat:${channel}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'Message',
          filter: `channel=eq.${channel}`
        }, () => {
          loadMessages(); 
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !session?.user) return;
    
    const playerId = (session.user as any).playerId;
    if (!playerId) {
      alert("Tu usuario no está vinculado a un jugador.");
      return;
    }

    await fetch("/api/chat", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ 
        channel, 
        player_id: playerId, 
        content: input.trim() 
      }) 
    });
    setInput("");
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
            <p>Comunicación del equipo {isSupabaseConfigured ? "(Tiempo Real ⚡)" : "(Modo Dev 🕒)"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{session?.user?.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(session?.user as any)?.role?.toUpperCase()}</div>
            </div>
            <div className="chat-avatar" style={{ background: "var(--val-red)", color: "#fff", width: 36, height: 36 }}>
              {session?.user?.name?.[0]}
            </div>
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
          <button className="btn btn-primary" onClick={send} disabled={!input.trim()}>Enviar</button>
        </div>
      </div>
    </>
  );
}

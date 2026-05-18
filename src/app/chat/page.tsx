/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useEffect, useState, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Message { 
  id: number; 
  channel: string; 
  player_id: string; 
  player_name: string; 
  avatar_color: string; 
  content: string; 
  created_at: string; 
}

const CHANNELS = ["general", "estrategias", "disponibilidad", "off-topic"];

export default function ChatPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState("general");
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Messages
  const {
    data: chatData,
    isLoading: chatLoading
  } = useQuery<{ messages: Message[] }>({
    queryKey: ["chat", channel],
    queryFn: async () => {
      const res = await fetch(`/api/chat?channel=${channel}&limit=100`);
      if (!res.ok) throw new Error("Error al cargar chat");
      return res.json();
    },
    enabled: !!session,
  });

  const messages = chatData?.messages || [];
  const loading = chatLoading;

  // 2. Supabase Realtime / Polling Subscription
  useEffect(() => {
    if (isSupabaseConfigured) {
      const subscription = supabase
        .channel(`chat:${channel}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'Message',
          filter: `channel=eq.${channel}`
        }, () => {
          queryClient.invalidateQueries({ queryKey: ["chat", channel] }); 
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["chat", channel] });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [channel, queryClient]);

  // 3. Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 4. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!session?.user) return;
      const playerId = (session.user as any).playerId;
      if (!playerId) {
        throw new Error("Tu usuario no está vinculado a un jugador.");
      }
      const res = await fetch("/api/chat", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          channel, 
          player_id: playerId, 
          content: content.trim() 
        }) 
      });
      if (!res.ok) throw new Error("Error al enviar mensaje");
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["chat", channel] });
    },
    onError: (err: any) => {
      alert(err.message || "Error al enviar mensaje");
    }
  });

  const send = () => {
    if (!input.trim()) return;
    sendMessageMutation.mutate(input);
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
      <div className="page-header hero-gradient" style={{ borderBottom: "none", background: "transparent", padding: "24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: 32, fontWeight: 800 }}>Chat de Equipo</h1>
            <p style={{ fontSize: 14, marginTop: 4 }}>Canal de comunicación {isSupabaseConfigured ? "en tiempo real ⚡" : "modo polling 🕒"}</p>
          </div>
          <div className="card glass-card" style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--val-red)" }}>{session?.user?.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{session?.user?.role?.toUpperCase()}</div>
            </div>
            <div className="chat-avatar" style={{ background: "var(--val-red)", color: "#fff", width: 32, height: 32, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {session?.user?.name?.[0]}
            </div>
          </div>
        </div>
        <div className="channel-tabs" style={{ marginTop: 24 }}>
          {CHANNELS.map(c => (
            <button key={c} className={`channel-tab ${channel === c ? "active" : ""}`} onClick={() => setChannel(c)}>
              <span style={{ opacity: 0.5, marginRight: 4 }}>#</span>{c}
            </button>
          ))}
        </div>
      </div>
      <div className="page-content animate-in" style={{ paddingTop: 0 }}>
        <div className="chat-container">
          <div className="chat-messages">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="chat-message" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <Skeleton width={36} height={36} circle />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <Skeleton width={80} height={14} />
                      <Skeleton width={40} height={10} />
                    </div>
                    <Skeleton width="90%" height={14} />
                  </div>
                </div>
              ))
            ) : (
              <>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
                    No hay mensajes en #{channel}. ¡Sé el primero!
                  </div>
                )}
                {messages.map(m => {
                  const isMe = String(m.player_id) === String((session?.user as any)?.playerId);
                  return (
                    <div key={m.id} className={`chat-message ${isMe ? "is-me" : ""} animate-fade-in`}>
                      <div className="chat-avatar" style={{ background: m.avatar_color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
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
                  );
                })}
              </>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-bar">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && send()} 
              placeholder={`Escribe un mensaje en #${channel}...`} 
              autoComplete="off"
            />
            <button className="btn btn-primary btn-icon" onClick={send} disabled={!input.trim() || sendMessageMutation.isPending} title="Enviar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

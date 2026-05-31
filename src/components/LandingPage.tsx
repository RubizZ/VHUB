/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";

export function LandingPage() {
  // Allow body scroll only when landing page is active
  useEffect(() => {
    document.body.classList.add("landing-page");
    return () => {
      document.body.classList.remove("landing-page");
    };
  }, []);

  return (
    <div className="landing-wrapper animate-in">
      {/* Navigation */}
      <header className="landing-nav">
        <div className="landing-brand">
          <Image src="/logo.png" alt="VHUB" width={38} height={38} style={{ objectFit: "contain" }} priority />
          <div className="landing-brand-text">
            <h1>VHUB</h1>
            <span>Premier Platform</span>
          </div>
        </div>
        <Link href="/login" className="btn btn-secondary btn-sm" style={{ borderRadius: "var(--radius-md)", padding: "8px 20px" }}>
          Iniciar Sesión
        </Link>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-badge">Plataforma Premier Completa</div>
        <h2 className="landing-title">
          Gestiona tu Equipo de <br />
          <span>Valorant Premier</span> al Siguiente Nivel
        </h2>
        <p className="landing-subtitle">
          Diseña estrategias en tiempo real, coordina la disponibilidad de tus jugadores, 
          chatea en directo y mantén sincronizadas tus estadísticas directamente desde la API oficial de Riot Games.
        </p>

        <div className="landing-ctas">
          <Link href="/register" className="btn-landing-primary">
            Empezar a Competir
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </Link>
          <Link href="/login" className="btn-landing-secondary">
            Panel de Control
          </Link>
        </div>
      </section>

      {/* UI Tactical Preview Mockup */}
      <section className="landing-preview-wrap">
        <div className="landing-preview-frame">
          <div className="landing-preview-inner">
            <div className="landing-preview-header">
              <div className="landing-preview-dot" style={{ background: "#FF5F56" }}></div>
              <div className="landing-preview-dot" style={{ background: "#FFBD2E" }}></div>
              <div className="landing-preview-dot" style={{ background: "#27C93F" }}></div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "12px", fontFamily: "var(--font-valorant)", letterSpacing: "1px" }}>VHUB_STRATEGY_BOARD_BIND.EXE</span>
            </div>
            <div className="landing-preview-content">
              <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
                {/* Mock Sidebar Info */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="card glass-card" style={{ padding: "16px", border: "1px solid rgba(255, 70, 85, 0.2)" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--val-red)", marginBottom: "8px", textTransform: "uppercase" }}>Táctica: Split A-Rush</h4>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                      Ejecución rápida por A-Main utilizando humos de Brimstone en Heaven y Screens, con flash de Reyna para limpiar entrada.
                    </p>
                  </div>
                  <div className="card glass-card" style={{ padding: "16px" }}>
                    <h4 style={{ fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Agentes Asignados</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--val-cyan)" }}></span>
                        <span>Jett (Entry)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--val-purple)" }}></span>
                        <span>Brimstone (Humos)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--val-yellow)" }}></span>
                        <span>Reyna (Apoyo/Flash)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Tactical Canvas */}
                <div className="card glass-card" style={{ height: "260px", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
                  {/* Grid Lines */}
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
                  
                  {/* Map Sketch Layout */}
                  <div style={{ width: "80%", height: "80%", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "var(--radius-lg)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ position: "absolute", top: "10px", left: "10px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-valorant)" }}>SPAWN_ATTACKERS</span>
                    <span style={{ position: "absolute", bottom: "10px", right: "10px", fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-valorant)" }}>SITE_A</span>
                    
                    {/* Tactical Lines */}
                    <svg style={{ position: "absolute", width: "100%", height: "100%", top: 0, left: 0, pointerEvents: "none" }}>
                      <path d="M 40,60 Q 140,40 220,100 T 360,120" fill="none" stroke="var(--val-red)" strokeWidth="3" strokeDasharray="6" />
                      <circle cx="360" cy="120" r="6" fill="var(--val-red)" />
                      {/* Smoke */}
                      <circle cx="280" cy="90" r="22" fill="rgba(255, 70, 85, 0.2)" stroke="var(--val-red)" strokeWidth="1" />
                      <circle cx="300" cy="85" r="18" fill="rgba(255, 70, 85, 0.15)" />
                    </svg>

                    {/* Agent Icons placement */}
                    <div style={{ position: "absolute", top: "35px", left: "30px", width: "24px", height: "24px", borderRadius: "50%", background: "var(--val-cyan)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", color: "#000", border: "2px solid #fff" }}>J</div>
                    <div style={{ position: "absolute", top: "75px", left: "120px", width: "24px", height: "24px", borderRadius: "50%", background: "var(--val-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", color: "#fff", border: "2px solid #fff" }}>B</div>
                    <div style={{ position: "absolute", top: "115px", left: "200px", width: "24px", height: "24px", borderRadius: "50%", background: "var(--val-yellow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", color: "#000", border: "2px solid #fff" }}>R</div>

                    {/* Spike plant icon */}
                    <div style={{ position: "absolute", top: "108px", left: "348px", animation: "pulseGlow 1.5s infinite" }}>🎯</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="landing-grid">
        <div className="landing-card" style={{ "--card-glow": "rgba(168, 85, 247, 0.08)", "--card-glow-border": "rgba(168, 85, 247, 0.25)", "--card-glow-shadow": "rgba(168, 85, 247, 0.15)" } as any}>
          <div className="landing-card-icon" style={{ color: "var(--val-purple)" }}>🗺️</div>
          <h3 className="landing-card-title">Estrategias</h3>
          <p className="landing-card-desc">
            Dibuja en pizarras tácticas interactivas sobre mapas oficiales. Diseña entradas y defensas perfectas para coordinar a tu plantilla.
          </p>
        </div>

        <div className="landing-card" style={{ "--card-glow": "rgba(245, 158, 11, 0.08)", "--card-glow-border": "rgba(245, 158, 11, 0.25)", "--card-glow-shadow": "rgba(245, 158, 11, 0.15)" } as any}>
          <div className="landing-card-icon" style={{ color: "var(--val-yellow)" }}>📅</div>
          <h3 className="landing-card-title">Disponibilidad</h3>
          <p className="landing-card-desc">
            Calendarios interactivos unificados. Olvídate de preguntar quién puede jugar cada día; los horarios cuadran automáticamente.
          </p>
        </div>

        <div className="landing-card" style={{ "--card-glow": "rgba(0, 212, 170, 0.08)", "--card-glow-border": "rgba(0, 212, 170, 0.25)", "--card-glow-shadow": "rgba(0, 212, 170, 0.15)" } as any}>
          <div className="landing-card-icon" style={{ color: "var(--val-cyan)" }}>💬</div>
          <h3 className="landing-card-title">Chat en Vivo</h3>
          <p className="landing-card-desc">
            Canales de chat dedicados para discutir tácticas, concretar entrenamientos y mantener al equipo en sintonía de forma constante.
          </p>
        </div>

        <div className="landing-card" style={{ "--card-glow": "rgba(255, 70, 85, 0.08)", "--card-glow-border": "rgba(255, 70, 85, 0.25)", "--card-glow-shadow": "rgba(255, 70, 85, 0.15)" } as any}>
          <div className="landing-card-icon" style={{ color: "var(--val-red)" }}>🏆</div>
          <h3 className="landing-card-title">API de Premier</h3>
          <p className="landing-card-desc">
            Integración de estadísticas reales. Sincroniza clasificaciones, historial de partidos, victorias, derrotas y puntos de temporada.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <Image src="/logo.png" alt="VHUB" width={32} height={32} style={{ objectFit: "contain" }} />
          <span style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "1px" }}>VHUB</span>
        </div>
        <p className="landing-footer-disclaimer">
          <strong>VHUB</strong>{" "}no cuenta con el respaldo de Riot Games y no refleja los puntos de vista ni las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas las propiedades asociadas son marcas comerciales o marcas comerciales registradas de Riot Games, Inc. VHUB se creó bajo la política de &quot;Jibber Jabber legal&quot; de Riot Games utilizando activos propiedad de Riot Games. Riot Games no respalda ni patrocina este proyecto.
        </p>
      </footer>
    </div>
  );
}

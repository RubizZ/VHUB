 
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { PREMIER_DIVISIONS } from "@/lib/premier-divisions";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TeamForm {
  name: string;
  slug: string;
  logo_url: string;
  inviteCode: string | null;
  premier_name?: string;
  tag?: string;
  division?: string | number;
  conference?: string;
}

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<TeamForm>({ name: "", slug: "", logo_url: "", inviteCode: null, premier_name: "", tag: "", division: "", conference: "NONE" });
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const canManage = session?.user?.role === "team_admin" || session?.user?.role === "super_admin";

  // 1. Fetch Current Team
  const {
    data: teamData,
    isLoading: teamLoading
  } = useQuery<{ team: TeamForm }>({
    queryKey: ["currentTeam"],
    queryFn: async () => {
      const res = await fetch("/api/team/current");
      if (!res.ok) throw new Error("Error loading team data");
      return res.json();
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (teamData?.team) {
      const t = teamData.team as any;
      setForm({
        name: t.name || "",
        slug: t.slug || "",
        logo_url: t.logo_url || "",
        inviteCode: t.inviteCode || null,
        premier_name: t.premierTeam?.name || "",
        tag: t.premierTeam?.tag || "",
        division: t.premierTeam?.division || "",
        conference: t.premierTeam?.conference || "NONE"
      });
    }
  }, [teamData]);

  // 2. Save Team Mutation
  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/team/current", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: form.name, 
          logo_url: form.logo_url,
          premier_name: form.premier_name,
          tag: form.tag,
          division: form.division,
          conference: form.conference
        })
      });
      if (!res.ok) throw new Error("Error saving settings");
      return res.json();
    },
    onSuccess: () => {
      setMessage("✅ Configuración guardada correctamente");
      queryClient.invalidateQueries({ queryKey: ["currentTeam"] });
      setTimeout(() => setMessage(""), 3000);
    },
    onError: () => {
      setMessage("❌ Error al guardar los cambios");
    }
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    saveTeamMutation.mutate();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/team/logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error uploading logo");

      setForm((prev) => ({ ...prev, logo_url: data.url }));
      setMessage("✅ Logo subido correctamente");
      setTimeout(() => setMessage(""), 3000);
      queryClient.invalidateQueries({ queryKey: ["currentTeam"] });
      // Update session if it's cached somewhere
    } catch (err: any) {
      console.error(err);
      setMessage("❌ Error al subir el logo");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const loading = teamLoading;

  if (!canManage) {
    return <div className="p-20 text-center">Acceso restringido a administradores de equipo.</div>;
  }

  return (
    <div className="page-container" style={{ padding: "clamp(20px, 4vw, 40px) 20px" }}>
      <header className="page-header" style={{ marginBottom: 40, textAlign: "center" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 900, textShadow: "0 0 20px rgba(0, 212, 170, 0.4)", marginBottom: 8, letterSpacing: "-0.5px" }}>⚙️ Ajustes de Equipo</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "16px" }}>Configura la identidad y preferencias de tu organización</p>
      </header>

      <div className="page-content animate-in" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
          
          {/* LEFT COLUMN: IDENTITY FORM */}
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <div className="glass-card" style={{ padding: "clamp(20px, 4vw, 32px)", borderRadius: "20px", background: "rgba(15,15,20,0.6)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0, 212, 170, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--val-cyan)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Identidad del Equipo</h3>
              </div>
              
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 10 }} /><Skeleton width="100%" height={50} style={{ borderRadius: 12 }} /></div>
                  <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 10 }} /><Skeleton width="100%" height={50} style={{ borderRadius: 12 }} /></div>
                  <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 10 }} /><Skeleton width="100%" height={50} style={{ borderRadius: 12 }} /></div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}><Skeleton width={100} height={14} style={{ marginBottom: 10 }} /><Skeleton width="100%" height={50} style={{ borderRadius: 12 }} /></div>
                    <div style={{ flex: 1 }}><Skeleton width={100} height={14} style={{ marginBottom: 10 }} /><Skeleton width="100%" height={50} style={{ borderRadius: 12 }} /></div>
                  </div>
                  <Skeleton width="100%" height={50} style={{ borderRadius: 12, marginTop: 16 }} />
                </div>
              ) : (
                <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {message && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: message.includes("❌") ? "rgba(255, 70, 85, 0.1)" : "rgba(0, 212, 170, 0.1)", color: message.includes("❌") ? "var(--val-red)" : "var(--val-cyan)", borderRadius: 12, fontSize: 14, fontWeight: 600, border: `1px solid ${message.includes("❌") ? "rgba(255, 70, 85, 0.2)" : "rgba(0, 212, 170, 0.2)"}` }}>
                      {message}
                    </div>
                  )}
                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Nombre del Equipo</label>
                    <input 
                      type="text"
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                      style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, transition: "all 0.2s", outline: "none" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--val-cyan)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 212, 170, 0.15)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Slug (Identificador en URL)</label>
                    <input 
                      disabled 
                      value={form.slug} 
                      style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.5)", border: "1px dashed rgba(255,255,255,0.1)", color: "var(--val-red)", fontSize: 14, fontFamily: "JetBrains Mono, monospace" }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Logo del Equipo</label>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 24 }}>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: "none" }} 
                        accept="image/*" 
                        onChange={handleLogoUpload}
                      />
                      <div 
                        onClick={() => !uploadingLogo && fileInputRef.current?.click()} 
                        style={{
                          width: 80, height: 80, borderRadius: 16, background: "rgba(0,0,0,0.3)", 
                          border: "2px dashed rgba(255,255,255,0.2)", display: "flex", 
                          alignItems: "center", justifyContent: "center", cursor: "pointer", 
                          position: "relative", overflow: "hidden", transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--val-cyan)"; e.currentTarget.style.background = "rgba(0, 212, 170, 0.1)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "rgba(0,0,0,0.3)"; }}
                      >
                        {uploadingLogo ? (
                          <div style={{ width: 24, height: 24, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        ) : form.logo_url ? (
                          <img src={form.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px 0" }}>Haz clic en el recuadro para subir un archivo de imagen (PNG, JPG) desde tu ordenador.</p>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="btn" style={{ padding: "8px 16px", fontSize: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
                          Seleccionar Imagen
                        </button>
                      </div>
                    </div>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "8px 0" }} />
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255, 70, 85, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--val-red)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </div>
                    <h4 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--val-red)" }}>Datos de Valorant Premier</h4>
                  </div>

                  <div className="form-group">
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Nombre Oficial en Premier</label>
                    <input 
                      placeholder="Ej: G2 Esports"
                      value={form.premier_name || ""} 
                      onChange={e => setForm({ ...form, premier_name: e.target.value })} 
                      style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, transition: "all 0.2s", outline: "none" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--val-yellow)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245, 158, 11, 0.15)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div className="form-group" style={{ flex: "1 1 200px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Tag de Premier (#TAG)</label>
                      <input 
                        placeholder="Ej: ABC"
                        value={form.tag || ""} 
                        onChange={e => setForm({ ...form, tag: e.target.value.toUpperCase().replace("#", "") })} 
                        style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, transition: "all 0.2s", outline: "none", fontFamily: "JetBrains Mono, monospace" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--val-yellow)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245, 158, 11, 0.15)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: "1 1 200px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>División</label>
                      <select 
                        value={form.division || ""} 
                        onChange={e => setForm({ ...form, division: e.target.value ? Number(e.target.value) : "" })}
                        style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, transition: "all 0.2s", outline: "none", appearance: "none" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--val-yellow)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245, 158, 11, 0.15)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <option value="" style={{ background: "#111" }}>Selecciona tu división...</option>
                        {PREMIER_DIVISIONS.map(div => (
                          <option key={div.id} value={div.id} style={{ background: "#111" }}>{div.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: "1 1 200px" }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, marginBottom: "8px", color: "var(--text-secondary)", letterSpacing: "1px", textTransform: "uppercase" }}>Región</label>
                      <select 
                        value={form.conference || "NONE"} 
                        onChange={e => setForm({ ...form, conference: e.target.value })}
                        style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, transition: "all 0.2s", outline: "none", appearance: "none" }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--val-yellow)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245, 158, 11, 0.15)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <option value="NONE" style={{ background: "#111" }}>Sin Región / No participamos</option>
                        <option value="EU_IBIT" style={{ background: "#111" }}>Europa (Iberia, Italia, Balcanes)</option>
                        <option value="EU_FRANCE" style={{ background: "#111" }}>Europa (Francia)</option>
                        <option value="EU_DACH" style={{ background: "#111" }}>Europa (DACH - DE/AT/CH)</option>
                        <option value="EU_NORTH" style={{ background: "#111" }}>Europa (Norte)</option>
                        <option value="EU_EAST" style={{ background: "#111" }}>Europa (Este)</option>
                        <option value="EU_TURKEY" style={{ background: "#111" }}>Europa (Turquía)</option>
                        <option value="EU_MIDDLE_EAST" style={{ background: "#111" }}>Europa (Oriente Medio)</option>
                        <option value="NA_EAST" style={{ background: "#111" }}>Norteamérica Este</option>
                        <option value="NA_WEST" style={{ background: "#111" }}>Norteamérica Oeste</option>
                        <option value="LATAM_NORTH" style={{ background: "#111" }}>LATAM Norte</option>
                        <option value="LATAM_SOUTH" style={{ background: "#111" }}>LATAM Sur</option>
                        <option value="BR" style={{ background: "#111" }}>Brasil</option>
                        <option value="AP" style={{ background: "#111" }}>Asia Pacífico</option>
                        <option value="KR" style={{ background: "#111" }}>Corea</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary hover-lift" disabled={saveTeamMutation.isPending} style={{ padding: "18px", fontSize: 16, fontWeight: 800, borderRadius: 12, marginTop: 8, boxShadow: "0 4px 20px rgba(0, 212, 170, 0.3)" }}>
                    {saveTeamMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: INVITES & REQUESTS */}
          <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            
            {/* Invite Link Card */}
            <div className="glass-card hover-lift transition-smooth" style={{ padding: "clamp(20px, 4vw, 28px)", borderRadius: "20px", background: "linear-gradient(145deg, rgba(20,20,25,0.8) 0%, rgba(15,15,20,0.6) 100%)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--val-yellow)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Enlace de Invitación</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Comparte este enlace para que nuevos usuarios se unan directamente al equipo.
              </p>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skeleton width="100%" height={50} style={{ borderRadius: 12 }} />
                  <Skeleton width="100%" height={36} style={{ borderRadius: 8 }} />
                </div>
              ) : (
                <InviteLinkSection inviteCode={form.inviteCode} />
              )}
            </div>

            {/* Join Requests Card */}
            <div className="glass-card" style={{ padding: "clamp(20px, 4vw, 28px)", borderRadius: "20px", background: "rgba(15,15,20,0.6)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255, 70, 85, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--val-red)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Solicitudes de Unión</h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Gestiona quién puede unirse a tu equipo.
              </p>
              <JoinRequests />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function JoinRequests() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Fetch Requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery<{ requests: any[] }>({
    queryKey: ["joinRequests"],
    queryFn: async () => {
      const res = await fetch("/api/teams/requests");
      if (!res.ok) throw new Error("Error loading requests");
      return res.json();
    },
    enabled: !!session,
  });

  const requests = requestsData?.requests || [];
  const loading = requestsLoading;

  // Resolve Request Mutation
  const resolveRequestMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await fetch(`/api/teams/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!res.ok) throw new Error("Error resolving request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joinRequests"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
    }
  });

  const handleRequest = (id: string, action: "approve" | "reject") => {
    resolveRequestMutation.mutate({ id, action });
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={150} height={10} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton width={36} height={36} style={{ borderRadius: 8 }} />
            <Skeleton width={36} height={36} style={{ borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
  if (requests.length === 0) return (
    <div style={{ padding: "32px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.1)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, margin: "0 auto 12px auto" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="23" y1="11" x2="17" y2="11"></line></svg>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No hay solicitudes pendientes.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {requests.map(req => (
        <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", transition: "all 0.2s" }} className="hover-lift">
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{req.user.name || "Usuario"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{req.user.email}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button 
              onClick={() => handleRequest(req.id, "reject")}
              disabled={resolveRequestMutation.isPending}
              style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255, 70, 85, 0.1)", color: "var(--val-red)", border: "1px solid rgba(255, 70, 85, 0.2)", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={e => { e.currentTarget.style.background = "var(--val-red)"; e.currentTarget.style.color = "#fff"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(255, 70, 85, 0.1)"; e.currentTarget.style.color = "var(--val-red)"; }}
              title="Rechazar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <button 
              onClick={() => handleRequest(req.id, "approve")}
              disabled={resolveRequestMutation.isPending}
              style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 212, 170, 0.1)", color: "var(--val-cyan)", border: "1px solid rgba(0, 212, 170, 0.2)", cursor: "pointer", transition: "all 0.2s" }}
              onMouseOver={e => { e.currentTarget.style.background = "var(--val-cyan)"; e.currentTarget.style.color = "#fff"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(0, 212, 170, 0.1)"; e.currentTarget.style.color = "var(--val-cyan)"; }}
              title="Aprobar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InviteLinkSection({ inviteCode }: { inviteCode: string | null }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteCode ? `${window.location.origin}/register?invite=${inviteCode}` : "";

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate Invite Mutation
  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/team/invite", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error("Error generating invite link");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentTeam"] });
    }
  });

  const generateNewCode = () => {
    if (inviteCode && !confirm("¿Estás seguro de que quieres regenerar el enlace? El anterior dejará de funcionar en todas las aplicaciones donde lo hayas configurado.")) return;
    generateInviteMutation.mutate();
  };

  const generating = generateInviteMutation.isPending;

  if (!inviteCode) {
    return (
      <button className="btn btn-primary" onClick={generateNewCode} disabled={generating} style={{ width: "100%", padding: "16px", borderRadius: 12, fontWeight: 700 }}>
        {generating ? "Generando..." : "Generar Enlace de Invitación"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          background: "rgba(0,0,0,0.4)", 
          borderRadius: 12, 
          padding: "6px 6px 6px 16px", 
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.3)"
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 13, color: "var(--val-yellow)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {inviteUrl}
        </span>
        <button 
          onClick={handleCopy} 
          style={{ 
            background: copied ? "var(--val-cyan)" : "rgba(255,255,255,0.1)", 
            color: copied ? "#000" : "#fff", 
            border: "none", 
            borderRadius: 8, 
            padding: "10px 16px", 
            fontSize: 13, 
            fontWeight: 700, 
            cursor: "pointer", 
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Copiado
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copiar
            </>
          )}
        </button>
      </div>
      <button 
        onClick={generateNewCode} 
        disabled={generating}
        style={{ 
          fontSize: 12, 
          padding: "10px 16px", 
          background: "transparent", 
          color: "var(--val-red)", 
          border: "1px dashed rgba(255, 70, 85, 0.3)", 
          borderRadius: 8,
          cursor: "pointer",
          transition: "all 0.2s",
          fontWeight: 600
        }}
        onMouseOver={e => { e.currentTarget.style.background = "rgba(255, 70, 85, 0.05)"; e.currentTarget.style.borderColor = "var(--val-red)"; }}
        onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255, 70, 85, 0.3)"; }}
      >
        {generating ? "Generando..." : "Generar Nuevo Enlace (Invalida el actual)"}
      </button>
    </div>
  );
}

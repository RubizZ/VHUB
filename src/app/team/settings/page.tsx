/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { PREMIER_DIVISIONS } from "@/lib/premier-divisions";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface TeamForm {
  name: string;
  slug: string;
  logo_url: string;
  tag: string;
  division: string | number;
  inviteCode: string | null;
}

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<TeamForm>({ name: "", slug: "", logo_url: "", tag: "", division: "", inviteCode: null });
  const [message, setMessage] = useState("");

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
      setForm(teamData.team);
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
          tag: form.tag,
          division: form.division
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

  const loading = teamLoading;

  if (!canManage) {
    return <div className="p-20 text-center">Acceso restringido a administradores de equipo.</div>;
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>⚙️ Ajustes de Equipo</h1>
        <p style={{ color: "var(--text-secondary)" }}>Configura la identidad y preferencias de tu organización</p>
      </header>

      <div className="page-content animate-in">
        <div className="grid grid-2" style={{ maxWidth: 1000 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Identidad del Equipo</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 8 }} /><Skeleton width="100%" height={40} /></div>
                <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 8 }} /><Skeleton width="100%" height={40} /></div>
                <div className="form-group"><Skeleton width={120} height={14} style={{ marginBottom: 8 }} /><Skeleton width="100%" height={40} /></div>
                <div className="form-row" style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}><Skeleton width={100} height={14} style={{ marginBottom: 8 }} /><Skeleton width="100%" height={40} /></div>
                  <div style={{ flex: 1 }}><Skeleton width={100} height={14} style={{ marginBottom: 8 }} /><Skeleton width="100%" height={40} /></div>
                </div>
                <Skeleton width={150} height={40} />
              </div>
            ) : (
              <form onSubmit={save}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Nombre del Equipo</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    value={form.name} 
                    onChange={e => setForm({ ...form, name: e.target.value })} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Slug (Identificador en URL)</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    disabled 
                    value={form.slug} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label>URL del Logo</label>
                  <input 
                    className="input-field" 
                    style={{ width: "100%" }} 
                    placeholder="https://ejemplo.com/logo.png"
                    value={form.logo_url || ""} 
                    onChange={e => setForm({ ...form, logo_url: e.target.value })} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                    <label>Tag de Premier (#TAG)</label>
                    <input 
                      className="input-field" 
                      style={{ width: "100%" }} 
                      placeholder="Ej: ABC"
                      value={form.tag || ""} 
                      onChange={e => setForm({ ...form, tag: e.target.value.toUpperCase().replace("#", "") })} 
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 16 }}>
                    <label>División</label>
                    <select 
                      className="input-field" 
                      style={{ width: "100%" }} 
                      value={form.division || ""} 
                      onChange={e => setForm({ ...form, division: e.target.value ? Number(e.target.value) : "" })}
                    >
                      <option value="">Selecciona tu división...</option>
                      {PREMIER_DIVISIONS.map(div => (
                        <option key={div.id} value={div.id}>{div.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {message && (
                  <div style={{ padding: 12, background: "rgba(0,212,170,0.1)", color: "var(--val-cyan)", borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                    {message}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={saveTeamMutation.isPending}>
                  {saveTeamMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Enlace de Invitación</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Comparte este enlace para que nuevos usuarios se unan directamente al equipo.</p>
            {loading ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Skeleton width="100%" height={40} />
                <Skeleton width={100} height={40} />
              </div>
            ) : (
              <InviteLinkSection inviteCode={form.inviteCode} />
            )}
          </div>

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 20 }}>Solicitudes de Unión</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Gestiona quién puede unirse a tu equipo.</p>
            <JoinRequests />
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
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bg-glass)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={150} height={10} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton width={80} height={32} />
            <Skeleton width={80} height={32} />
          </div>
        </div>
      ))}
    </div>
  );
  if (requests.length === 0) return <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No hay solicitudes pendientes.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {requests.map(req => (
        <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bg-glass)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{req.user.name || "Usuario"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.user.email}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              className="btn" 
              style={{ padding: "6px 12px", fontSize: 12, background: "var(--val-red)", color: "#fff", border: "none" }}
              onClick={() => handleRequest(req.id, "reject")}
              disabled={resolveRequestMutation.isPending}
            >
              Rechazar
            </button>
            <button 
              className="btn btn-primary" 
              style={{ padding: "6px 12px", fontSize: 12 }}
              onClick={() => handleRequest(req.id, "approve")}
              disabled={resolveRequestMutation.isPending}
            >
              Aprobar
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
      <button className="btn" onClick={generateNewCode} disabled={generating}>
        {generating ? "Generando..." : "Generar Enlace de Invitación"}
      </button>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input 
          className="input-field" 
          style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }} 
          value={inviteUrl} 
          readOnly 
        />
        <button className="btn btn-primary" onClick={handleCopy} style={{ minWidth: 100 }}>
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <button 
        className="btn" 
        onClick={generateNewCode} 
        disabled={generating}
        style={{ fontSize: 12, padding: "6px 12px", background: "transparent", color: "var(--val-red)", border: "1px solid rgba(255, 70, 85, 0.3)" }}
      >
        {generating ? "Generando..." : "Generar Nuevo Enlace (Invalida el actual)"}
      </button>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const playerLinks = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/strategies", icon: "🗺️", label: "Estrategias" },
  { href: "/matches", icon: "🎮", label: "Partidos" },
  { href: "/availability", icon: "📅", label: "Disponibilidad" },
  { href: "/chat", icon: "💬", label: "Chat" },
  { href: "/stats", icon: "📊", label: "Estadísticas" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const loading = status === "loading";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">7R</div>
        <div>
          <h1>7R</h1>
          <span>Premier Hub</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {/* SECCIÓN JUGADOR */}
        <div className="nav-separator">TU EQUIPO</div>
        {playerLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="nav-link-icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
        <Link href="/profile" className={`nav-link ${pathname === "/profile" ? "active" : ""}`}>
          <span className="nav-link-icon">👤</span>
          Mi Perfil
        </Link>

        {/* SECCIÓN TEAM ADMIN */}
        {!loading && (role === "team_admin" || role === "super_admin") && (
          <>
            <div className="nav-separator">GESTIÓN DE EQUIPO</div>
            <Link 
              href="/team/roster" 
              className={`nav-link ${pathname === "/team/roster" ? "active" : ""}`}
            >
              <span className="nav-link-icon">📋</span>
              Plantilla
            </Link>
            <Link 
              href="/team/settings" 
              className={`nav-link ${pathname === "/team/settings" ? "active" : ""}`}
            >
              <span className="nav-link-icon">⚙️</span>
              Ajustes de Equipo
            </Link>
          </>
        )}

        {/* SECCIÓN SUPER ADMIN */}
        {!loading && role === "super_admin" && (
          <>
            <div className="nav-separator">SISTEMA</div>
            <Link 
              href="/admin" 
              className={`nav-link ${pathname === "/admin" ? "active" : ""}`}
            >
              <span className="nav-link-icon">📈</span>
              Panel Global
            </Link>
            <Link 
              href="/admin/teams" 
              className={`nav-link ${pathname === "/admin/teams" ? "active" : ""}`}
            >
              <span className="nav-link-icon">🏢</span>
              Equipos
            </Link>
          </>
        )}

        <div style={{ flex: 1 }} />
        
        <Link href="/settings" className={`nav-link ${pathname === "/settings" ? "active" : ""}`}>
          <span className="nav-link-icon">🛠️</span>
          Mi Cuenta
        </Link>
        <button onClick={() => signOut()} className="nav-link" style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer", color: "var(--val-red)" }}>
          <span className="nav-link-icon">🚪</span>
          Cerrar sesión
        </button>
      </nav>
    </aside>
  );
}

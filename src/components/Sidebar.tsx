"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession, signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role;
  const userName = session?.user?.name || "Usuario";
  const userEmail = session?.user?.email || "";
  const loading = status === "loading";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">VH</div>
        <div>
          <h1>V-HUB</h1>
          <span className="brand-tag">PREMIER PLATFORM</span>
        </div>
      </div>

      <nav className="sidebar-nav">
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

        {!loading && (role === "team_admin" || role === "super_admin") && (
          <>
            <div className="nav-separator">GESTIÓN DE EQUIPO</div>
            <Link href="/team/roster" className={`nav-link ${pathname === "/team/roster" ? "active" : ""}`}>
              <span className="nav-link-icon">📋</span> Plantilla
            </Link>
            <Link href="/team/settings" className={`nav-link ${pathname === "/team/settings" ? "active" : ""}`}>
              <span className="nav-link-icon">⚙️</span> Ajustes de Equipo
            </Link>
          </>
        )}

        {!loading && role === "super_admin" && (
          <>
            <div className="nav-separator">SISTEMA</div>
            <Link href="/admin" className={`nav-link ${pathname === "/admin" ? "active" : ""}`}>
              <span className="nav-link-icon">📈</span> Panel Global
            </Link>
            <Link href="/admin/teams" className={`nav-link ${pathname === "/admin/teams" ? "active" : ""}`}>
              <span className="nav-link-icon">🏢</span> Equipos
            </Link>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* SECCIÓN DE USUARIO - DISEÑO FINAL CORREGIDO */}
        <div className="user-section" ref={dropdownRef}>
          {isDropdownOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-header">
                <span className="user-email">{userEmail}</span>
                <span className="user-role-text">{(role || 'Miembro').replace('_', ' ').toUpperCase()}</span>
              </div>

              <div className="dropdown-menu">
                <Link href="/profile" className="menu-item-link" onClick={() => setIsDropdownOpen(false)}>
                  <span className="icon">👤</span> Ver Mi Perfil
                </Link>
                <Link href="/settings" className="menu-item-link" onClick={() => setIsDropdownOpen(false)}>
                  <span className="icon">⚙️</span> Ajustes de Cuenta
                </Link>
                <button className="menu-item-link riot-link-btn" onClick={() => signIn("riot-games")}>
                  <span className="icon">🔴</span> Vincular Riot ID
                </button>
                <div className="dropdown-sep"></div>
                <button className="menu-item-link logout-link-btn" onClick={() => signOut()}>
                  <span className="icon">🚪</span> Cerrar Sesión
                </button>
              </div>
            </div>
          )}

          <div className={`user-card-v2 ${isDropdownOpen ? 'is-open' : ''}`}>
            <Link href="/profile" className="profile-link-v2">
              <div className="user-avatar-v2">{userName.charAt(0)}</div>
              <div className="user-meta-v2">
                <span className="user-name-v2">{userName}</span>
                <span className="user-status-v2">● Conectado</span>
              </div>
            </Link>
            <button
              className="user-menu-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <style jsx>{`
        .brand-tag {
          font-size: 0.65rem;
          color: var(--val-red);
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .user-section {
          margin: 12px;
          position: relative;
        }

        .user-card-v2 {
          background: #1a1a23;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .user-card-v2.is-open {
          border-color: var(--val-red);
          box-shadow: 0 0 15px rgba(255, 70, 85, 0.1);
        }

        .profile-link-v2 {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          text-decoration: none !important;
          padding: 4px;
          color: white !important;
        }

        .user-avatar-v2 {
          width: 34px;
          height: 34px;
          background: var(--val-red);
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 15px;
          box-shadow: 0 4px 10px rgba(255, 70, 85, 0.3);
        }

        .user-meta-v2 {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }

        .user-name-v2 {
          font-size: 13px;
          font-weight: 700;
          color: white !important;
        }

        .user-status-v2 {
          font-size: 9px;
          color: var(--val-cyan);
          font-weight: 800;
          text-transform: uppercase;
        }

        .user-menu-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .user-menu-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        /* DROPDOWN V2 */
        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 10px);
          left: 0;
          width: 100%;
          background: #1a1a23;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          z-index: 1000;
          animation: slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 6px;
        }

        .user-email {
          display: block;
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-role-text {
          display: block;
          font-size: 9px;
          font-weight: 900;
          color: var(--val-red);
          letter-spacing: 1px;
          margin-top: 2px;
        }

        .menu-item-link {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          color: #d1d1d1 !important;
          text-decoration: none !important;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          transition: all 0.2s;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
        }

        .menu-item-link:visited {
          color: #d1d1d1 !important;
        }

        .menu-item-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white !important;
        }

        .riot-link-btn {
          color: var(--val-red) !important;
        }

        .riot-link-btn:hover {
          background: rgba(255, 70, 85, 0.1) !important;
          color: #ff5d6a !important;
        }

        .dropdown-sep {
          height: 1px;
          background: rgba(255, 255, 255, 0.05);
          margin: 6px;
        }

        .logout-link-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .icon {
          font-size: 16px;
          width: 18px;
        }
      `}</style>
    </aside>
  );
}

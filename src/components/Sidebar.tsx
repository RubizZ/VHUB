"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession, signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./Skeleton";

// Modern SVG Icons
const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Strategies: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  Matches: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12L10 16L18 8"/><circle cx="12" cy="12" r="10"/></svg>,
  Availability: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Chat: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Stats: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Roster: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Admin: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Profile: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Riot: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  Org: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Leaderboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
};

const playerLinks = [
  { href: "/", icon: <Icons.Dashboard />, label: "Dashboard" },
  { href: "/availability", icon: <Icons.Availability />, label: "Disponibilidad" },
  { href: "/strategies", icon: <Icons.Strategies />, label: "Estrategias" },
  { href: "/matches", icon: <Icons.Matches />, label: "Partidos" },
  { href: "/chat", icon: <Icons.Chat />, label: "Chat" },
  { href: "/stats", icon: <Icons.Stats />, label: "Estadísticas" },
  { href: "/leaderboard", icon: <Icons.Leaderboard />, label: "Clasificación" },
];

export function Sidebar({ 
  onShowDisclaimer,
  isOpen = false,
  onClose,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse
}: { 
  onShowDisclaimer?: () => void,
  isOpen?: boolean,
  onClose?: () => void,
  isDesktopCollapsed?: boolean,
  onToggleDesktopCollapse?: () => void
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role;
  const userName = session?.user?.name || "Usuario";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image;
  const loading = status === "loading";

  const { data: teamData, isLoading: isTeamLoading } = useQuery({
    queryKey: ["currentTeam"],
    queryFn: async () => {
      const res = await fetch("/api/team/current");
      if (!res.ok) throw new Error("Error loading team data");
      return res.json();
    },
    enabled: !!session,
  });

  const team = teamData?.team;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon" style={{ overflow: "hidden", background: (loading || isTeamLoading) ? "transparent" : undefined }}>
          {(loading || isTeamLoading) ? (
            <Skeleton width="100%" height="100%" style={{ borderRadius: 8 }} />
          ) : team?.logo_url ? (
            <img src={team.logo_url} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            team?.name?.[0]?.toUpperCase() || "VH"
          )}
        </div>
        <div className="sidebar-brand-text">
          {(loading || isTeamLoading) ? (
            <>
              <Skeleton width={100} height={20} style={{ marginBottom: 4 }} />
              <Skeleton width={120} height={12} />
            </>
          ) : (
            <>
              <h1 style={{ fontSize: team?.name?.length > 12 ? "16px" : "20px" }}>{team?.name || "V-HUB"}</h1>
              <span className="brand-tag">{team?.premierTeam?.tag ? `#${team.premierTeam.tag}` : "PREMIER PLATFORM"}</span>
            </>
          )}
        </div>
        {onToggleDesktopCollapse && (
          <button 
            className="desktop-menu-btn" 
            onClick={onToggleDesktopCollapse}
            aria-label="Alternar menú"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        {loading ? (
          <>
            <div className="nav-separator"><Skeleton width={80} height={12} /></div>
            {playerLinks.map((l, i) => (
              <div key={i} className="nav-link" style={{ pointerEvents: 'none', background: 'transparent', border: 'none' }}>
                <span className="nav-link-icon"><Skeleton width={18} height={18} style={{ borderRadius: 4 }} /></span>
                <Skeleton width={80 + (i % 3) * 20} height={16} />
              </div>
            ))}
            <div className="nav-separator" style={{ marginTop: 16 }}><Skeleton width={120} height={12} /></div>
            {[1, 2].map((_, i) => (
              <div key={`admin-${i}`} className="nav-link" style={{ pointerEvents: 'none', background: 'transparent', border: 'none' }}>
                <span className="nav-link-icon"><Skeleton width={18} height={18} style={{ borderRadius: 4 }} /></span>
                <Skeleton width={100 + i * 20} height={16} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="nav-separator">TU EQUIPO</div>
            {playerLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link ${pathname === l.href ? "active" : ""}`}
                onClick={handleLinkClick}
              >
                <span className="nav-link-icon">{l.icon}</span>
                <span className="nav-link-text">{l.label}</span>
              </Link>
            ))}

            {(role === "team_admin" || role === "super_admin") && (
              <>
                <div className="nav-separator">GESTIÓN DE EQUIPO</div>
                <Link href="/team/roster" className={`nav-link ${pathname === "/team/roster" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Roster /></span> <span className="nav-link-text">Plantilla</span>
                </Link>
                <Link href="/team/settings" className={`nav-link ${pathname === "/team/settings" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Settings /></span> <span className="nav-link-text">Ajustes de Equipo</span>
                </Link>
              </>
            )}

            {role === "super_admin" && (
              <>
                <div className="nav-separator">SISTEMA</div>
                <Link href="/admin" className={`nav-link ${pathname === "/admin" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Admin /></span> <span className="nav-link-text">Panel Global</span>
                </Link>
                <Link href="/admin/teams" className={`nav-link ${pathname === "/admin/teams" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Org /></span> <span className="nav-link-text">Equipos</span>
                </Link>
                <Link href="/admin/users" className={`nav-link ${pathname === "/admin/users" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Roster /></span> <span className="nav-link-text">Usuarios</span>
                </Link>
                <Link href="/admin/agents" className={`nav-link ${pathname === "/admin/agents" ? "active" : ""}`} onClick={handleLinkClick}>
                  <span className="nav-link-icon"><Icons.Strategies /></span> <span className="nav-link-text">Agentes y Habilidades</span>
                </Link>
              </>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        <div className="user-section-container" ref={dropdownRef}>
          {isDropdownOpen && (
            <div className="vhub-dropdown">
              <div className="vhub-dropdown-header">
                <span className="vhub-email">{userEmail}</span>
                <span className="vhub-role">{(role || 'Miembro').replace('_', ' ').toUpperCase()}</span>
              </div>

              <div className="vhub-dropdown-menu">
                <Link href="/profile" className="vhub-menu-item" onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}>
                  <span className="vhub-icon"><Icons.Profile /></span> Ver Mi Perfil
                </Link>
                <Link href="/settings" className="vhub-menu-item" onClick={() => { setIsDropdownOpen(false); handleLinkClick(); }}>
                  <span className="vhub-icon"><Icons.Settings /></span> Ajustes de Cuenta
                </Link>
                <button className="vhub-menu-item vhub-menu-item-riot" onClick={() => { setIsDropdownOpen(false); handleLinkClick(); signIn("riot-games"); }}>
                  <span className="vhub-icon"><Icons.Riot /></span> Vincular Riot ID
                </button>
                <div className="vhub-sep"></div>
                <button className="vhub-menu-item vhub-menu-item-logout" onClick={() => { setIsDropdownOpen(false); handleLinkClick(); signOut(); }}>
                  <span className="vhub-icon"><Icons.Logout /></span> Cerrar Sesión
                </button>
              </div>
            </div>
          )}

          <div 
            className={`vhub-user-card ${isDropdownOpen ? 'active' : ''}`}
            onClick={() => { if (!loading) setIsDropdownOpen(!isDropdownOpen); }}
          >
            <div className="vhub-avatar" style={{ overflow: "hidden", background: loading ? "transparent" : undefined }}>
              {loading ? (
                <Skeleton width="100%" height="100%" style={{ borderRadius: "50%" }} />
              ) : userImage ? (
                <img src={userImage} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                userName.charAt(0)
              )}
            </div>
            <div className="vhub-meta">
              {loading ? (
                <>
                  <Skeleton width={80} height={16} style={{ marginBottom: 4 }} />
                  <Skeleton width={50} height={12} />
                </>
              ) : (
                <>
                  <span className="vhub-username">{userName}</span>
                  <div className="vhub-status">Conectado</div>
                </>
              )}
            </div>
            {!loading && <svg className={`vhub-chevron ${isDropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>}
          </div>
        </div>

        {loading ? (
          <div className="disclaimer-btn" style={{ background: "transparent", pointerEvents: 'none', border: 'none', justifyContent: 'center' }}>
            <Skeleton width="80%" height={20} />
          </div>
        ) : (
          <button 
            onClick={() => {
              if (onShowDisclaimer) onShowDisclaimer();
              handleLinkClick();
            }}
            className="disclaimer-btn"
          >
            <svg 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg> <span className="nav-link-text">Exención de Riot Games</span>
          </button>
        )}
      </nav>

    </aside>
  );
}

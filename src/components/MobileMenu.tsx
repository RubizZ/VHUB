"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const Icons = {
  Roster: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Admin: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Logout: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Profile: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Stats: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Close: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

export function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role;

  if (!isOpen) return null;

  return (
    <div className="mobile-menu-overlay animate-fade-in" onClick={onClose}>
      <div className="mobile-menu-content animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="mobile-menu-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="vhub-avatar" style={{ width: 40, height: 40, fontSize: 18 }}>{session?.user?.name?.[0]}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{session?.user?.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{role?.replace('_', ' ')}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><Icons.Close /></button>
        </div>

        <div className="mobile-menu-body">
          <div className="nav-separator">General</div>
          <Link href="/stats" className={`nav-link ${pathname === "/stats" ? "active" : ""}`} onClick={onClose}>
            <span className="nav-link-icon"><Icons.Stats /></span> Estadísticas
          </Link>
          <Link href="/profile" className={`nav-link ${pathname === "/profile" ? "active" : ""}`} onClick={onClose}>
            <span className="nav-link-icon"><Icons.Profile /></span> Mi Perfil
          </Link>
          <Link href="/settings" className={`nav-link ${pathname === "/settings" ? "active" : ""}`} onClick={onClose}>
            <span className="nav-link-icon"><Icons.Settings /></span> Ajustes de Cuenta
          </Link>

          {(role === "team_admin" || role === "super_admin") && (
            <>
              <div className="nav-separator">Gestión de Equipo</div>
              <Link href="/team/roster" className={`nav-link ${pathname === "/team/roster" ? "active" : ""}`} onClick={onClose}>
                <span className="nav-link-icon"><Icons.Roster /></span> Plantilla
              </Link>
              <Link href="/team/settings" className={`nav-link ${pathname === "/team/settings" ? "active" : ""}`} onClick={onClose}>
                <span className="nav-link-icon"><Icons.Settings /></span> Ajustes de Equipo
              </Link>
            </>
          )}

          {role === "super_admin" && (
            <>
              <div className="nav-separator">Administración Global</div>
              <Link href="/admin" className={`nav-link ${pathname === "/admin" ? "active" : ""}`} onClick={onClose}>
                <span className="nav-link-icon"><Icons.Admin /></span> Panel Global
              </Link>
            </>
          )}

          <div style={{ marginTop: "auto", paddingTop: 20 }}>
            <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "flex-start", color: "var(--val-red)" }} onClick={() => signOut()}>
              <Icons.Logout /> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

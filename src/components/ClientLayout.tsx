"use client";
import { Sidebar } from "@/components/Sidebar";
import { usePathname } from "next/navigation";
import { useState, ReactNode } from "react";
import { useSession } from "next-auth/react";

export function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLandingPage = pathname === "/" && !session?.user?.id;
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/onboarding" || isLandingPage;
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className={`app-layout ${isDesktopCollapsed ? 'desktop-collapsed' : ''}`}>
      {/* Mobile Top Navbar */}
      <div className="mobile-top-nav">
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="mobile-top-nav-brand">V-HUB</div>
        <div style={{ width: 40 }}></div> {/* Spacer to center the brand */}
      </div>

      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <Sidebar 
        onShowDisclaimer={() => setShowDisclaimer(true)} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isDesktopCollapsed={isDesktopCollapsed}
        onToggleDesktopCollapse={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
      />
      
      <main className="main-content">
        {children}
      </main>

      {showDisclaimer && (
        <div className="modal-overlay" onClick={() => setShowDisclaimer(false)} style={{ zIndex: 9999 }}>
          <div 
            className="modal-content glass-card" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '450px', 
              border: '1px solid rgba(255, 70, 85, 0.25)', 
              boxShadow: '0 0 30px rgba(255, 70, 85, 0.15)',
              backgroundColor: 'rgba(18, 18, 26, 0.95)',
              padding: '24px'
            }}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--val-red)', letterSpacing: '0.5px' }}>EXENCIÓN DE RESPONSABILIDAD</h3>
              <button 
                className="btn-ghost" 
                onClick={() => setShowDisclaimer(false)}
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: 'var(--radius-sm)', 
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6', textAlign: 'justify', margin: 0 }}>
                <strong>VHUB</strong>{" "}no cuenta con el respaldo de Riot Games y no refleja los puntos de vista ni las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas las propiedades asociadas son marcas comerciales o marcas comerciales registradas de Riot Games, Inc.
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'justify', margin: 0, borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                VHUB se creó bajo la política "Jibber Jabber legal" de Riot Games utilizando activos propiedad de Riot Games. Riot Games no respalda ni patrocina este proyecto.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

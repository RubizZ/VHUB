"use client";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/onboarding";
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-layout">
      <Sidebar onShowDisclaimer={() => setShowDisclaimer(true)} />
      <main className="main-content">
        {children}
      </main>
      <BottomNav />

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
            <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.6', textAlign: 'justify', margin: 0 }}>
              <strong>VHUB</strong> no cuenta con el respaldo de Riot Games y no refleja los puntos de vista ni las opiniones de Riot Games ni de nadie oficialmente involucrado en la producción o gestión de las propiedades de Riot Games. Riot Games y todas las propiedades asociadas son marcas comerciales o marcas comerciales registradas de Riot Games, Inc.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: "🏠", label: "Dashboard" },
  { href: "/strategies", icon: "🗺️", label: "Estrategias" },
  { href: "/availability", icon: "📅", label: "Disponibilidad" },
  { href: "/chat", icon: "💬", label: "Chat" },
  { href: "/stats", icon: "📊", label: "Estadísticas" },
];

export function Sidebar() {
  const pathname = usePathname();
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="nav-link-icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <Link href="/settings" className={`nav-link ${pathname === "/settings" ? "active" : ""}`}>
          <span className="nav-link-icon">⚙️</span>
          Ajustes
        </Link>
      </nav>
    </aside>
  );
}

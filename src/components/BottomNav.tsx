"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/strategies", icon: "🗺️", label: "Strats" },
  { href: "/matches", icon: "🎮", label: "Partidos" },
  { href: "/availability", icon: "📅", label: "Dispo" },
  { href: "/chat", icon: "💬", label: "Chat" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`bottom-nav-link ${pathname === l.href ? "active" : ""}`}
          >
            <span className="bottom-nav-link-icon">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

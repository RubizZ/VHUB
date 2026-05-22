"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function UserPresenceProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const ping = async () => {
      try {
        await fetch("/api/ping", { method: "POST" });
      } catch (error) {
        console.error("Failed to ping presence", error);
      }
    };

    // Ping immediately on mount if authenticated
    ping();

    // Ping every 60 seconds
    const interval = setInterval(ping, 60000);

    return () => clearInterval(interval);
  }, [status]);

  return <>{children}</>;
}

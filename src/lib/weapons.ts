// Client-safe weapon types and fetch helpers using valorant-api.com

export interface ValorantWeapon {
  uuid: string;
  displayName: string;
  category: string; // e.g. "EEquippableCategory::Heavy"
  displayIcon: string | null;
  killStreamIcon: string | null;
}

/**
 * Normalized category label for display.
 */
export const WEAPON_CATEGORY_LABELS: Record<string, string> = {
  "EEquippableCategory::Heavy": "Pesadas",
  "EEquippableCategory::Rifle": "Rifles",
  "EEquippableCategory::Shotgun": "Escopetas",
  "EEquippableCategory::SMG": "SMG",
  "EEquippableCategory::Sniper": "Francotiradores",
  "EEquippableCategory::Sidearm": "Pistolas",
  "EEquippableCategory::Melee": "Cuerpo a cuerpo",
};

/**
 * Fetch all weapons from the valorant-api.com endpoint (server-side or API route).
 */
export async function getWeapons(): Promise<ValorantWeapon[]> {
  const res = await fetch("https://valorant-api.com/v1/weapons?language=es-ES");
  const json = await res.json();
  return (json.data as ValorantWeapon[]).map((w) => ({
    uuid: w.uuid,
    displayName: w.displayName,
    category: w.category,
    displayIcon: w.displayIcon,
    killStreamIcon: w.killStreamIcon,
  }));
}

// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

export interface SkillGeometry {
  type: "circle" | "rectangle" | "cone" | "infinite-wall" | "path" | "trapezoid" | "curve";
  radius?: number;
  width?: number;
  length?: number;
  angle?: number;
}

export interface SkillBehaviorFlags {
  throughWall?: boolean;
  projectile?: boolean;
  chargeable?: boolean;
  rolling?: boolean;
  recallable?: boolean; // La habilidad debe ser recogida manualmente antes de que empiece el cooldown (ej. C de Chamber)
  grantsWeapon?: boolean; // Actúa como arma (ej. Q/X de Chamber)
  teleportsToDeployed?: boolean; // Permite tepearse a esta habilidad si ya está desplegada
  instantSelfBuff?: boolean; // Habilidad de auto-aplicación instantánea (Buff)
  selfRevive?: boolean; // Auto-resurrección (ej. Clove X)
  targetRevive?: boolean; // Resurrección a aliado (ej. Sage X)
  activatableDeployable?: boolean; // Se puede activar una vez desplegada (ej. Cypher Q)
  twoPointDeployment?: boolean; // Se despliega trazando línea entre dos puntos (ej. Cypher C)
  deployablePreRound?: boolean; // Puede ser desplegada durante la fase de compra/pre-ronda
  controllablePath?: boolean; // Habilidad que se mueve dibujando un trazo (ej. Perro de Fade)
  triggerOnSight?: boolean; // Se detona/activa automáticamente al ver a un enemigo (ej. Wingman de Gekko)
  opaque?: boolean; // La figura renderizada bloquea la visión (se pinta opaca)
  hasHitbox?: boolean; // La figura colisiona con proyectiles (ej. Muro de Sage)
  stoppableInFlight?: boolean; // Habilidades en movimiento que se pueden detener manualmente (ej. Harbor C)
  generatesSoulOrbs?: boolean; // Enemigos sueltan orbes al morir o asistir (ej. Reyna/Iso)
  isolatesTarget?: boolean; // Aísla al objetivo a un "mundo aparte" (ej. Iso X)
}

export interface SkillBehavior {
  charges?: number;
  castTime?: number;
  speed?: number; // Velocidad de movimiento (ej. para el perro de Fade)
  duration?: number; // Duración activa en segundos (ej. para habilidades controlables)
  rechargeTime?: number;
  rechargeKills?: number; // Kills necesarias para recargar la habilidad (ej: 2)
  buffDuration?: number; // Tiempo en segundos que dura el buff activo
  buffApplied?: string; // Nombre del buffo aplicado (ej: "Vulnerable", "Escudo")
  debuffApplied?: string; // Nombre del debuffo aplicado a enemigos (ej: "Vulnerable")
  spawn: "player" | "ground" | "wall" | "projectile";
  spawnOffset?: number; // Desplazamiento en metros desde el agente (para habilidades que salen desde el jugador pero más adelante)
  maxCastRange?: number;
  groundRange?: number; // legacy
  projectileBounces?: number;
  chargeMinLength?: number;
  chargeMaxLength?: number;
  chargeTimePerMeter?: number;
  rollWaveCount?: number;
  rollTimeBetweenWaves?: number;
  consumesSkillKey?: string;
  flags?: SkillBehaviorFlags;
}

export interface AgentSkill {
  id: string;
  agentId: string;
  key: string;
  name: string;
  description: string | null;
  geometry: SkillGeometry;
  behavior: SkillBehavior;
  color: string | null;
  displayIcon?: string;
  enabled?: boolean;
}

export interface ValorantAgent {
  id: string;
  name: string;
  role: AgentRole;
  displayIcon: string;
  killfeedPortrait: string | null;
  fullPortrait: string | null;
  background: string | null;
  roleIcon: string;
  bgColors: string[];
  skills?: AgentSkill[];
}

export const ROLE_COLORS: Record<AgentRole, string> = {
  duelist: '#FF4655',
  initiator: '#00D4AA',
  controller: '#A855F7',
  sentinel: '#3B82F6',
};

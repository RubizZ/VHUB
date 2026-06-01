// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

export interface SkillGeometry {
  type: "none" | "circle" | "rectangle" | "cone" | "infinite-wall" | "path" | "trapezoid" | "curve" | "cross" | "line";
  radius?: number;
  width?: number;
  length?: number;
  angle?: number;
}

// Flags con sub-parámetros propios (su presencia implica activación)
export interface ProjectileFlag {
  speed?: number;
  maxDistance?: number;
  duration?: number;
  fixedDistance?: boolean;
  alwaysMaxDistance?: boolean;
}

export interface BouncingFlag {
  bounces?: number;
}

export interface ChargeableFlag {
  minLength?: number;
  maxLength?: number;
  timePerMeter?: number;
}

export interface RollingFlag {
  waveCount?: number;
  timeBetweenWaves?: number;
}

export interface ControllablePathFlag {
  speed?: number;
  duration?: number;
}

export interface InstantSelfBuffFlag {
  duration?: number;
  applied?: string;
}

export interface SkillBehaviorFlags {
  throughWall?: boolean;
  projectile?: ProjectileFlag;       // presencia = activo; sub-campos: speed, maxDistance, duration
  bouncing?: BouncingFlag;           // presencia = activo; sub-campos: bounces
  chargeable?: ChargeableFlag;       // presencia = activo; sub-campos: minLength, maxLength, timePerMeter
  rolling?: RollingFlag;             // presencia = activo; sub-campos: waveCount, timeBetweenWaves
  controllablePath?: ControllablePathFlag; // presencia = activo; sub-campos: speed, duration
  instantSelfBuff?: InstantSelfBuffFlag;  // presencia = activo; sub-campos: duration, applied
  recallable?: boolean;              // La habilidad debe ser recogida manualmente antes de que empiece el cooldown (ej. C de Chamber)
  grantsWeapon?: boolean;            // Actúa como arma (ej. Q/X de Chamber)
  teleportsToDeployed?: boolean;     // Permite tepearse a esta habilidad si ya está desplegada
  teleportsAgentInstantly?: boolean; // Teletransporte instantáneo sin desplegar ancla (ej. Omen C)
  selfRevive?: boolean;              // Auto-resurrección (ej. Clove X)
  targetRevive?: boolean;            // Resurrección a aliado (ej. Sage X)
  activatableDeployable?: boolean;   // Se puede activar una vez desplegada (ej. Cypher Q)
  twoPointDeployment?: boolean;      // Requiere dos puntos para desplegarse (ej. Cypher C, Fade C)
  twoPointDirectional?: boolean;     // Si es true, el segundo punto indica solo dirección (la geometría no se acorta)
  deployablePreRound?: boolean;      // Puede ser desplegada durante la fase de compra/pre-ronda
  triggerOnSight?: boolean;          // Se detona/activa automáticamente al ver a un enemigo (ej. Wingman de Gekko)
  opaque?: boolean;                  // La figura renderizada bloquea la visión (se pinta opaca)
  hasHitbox?: boolean;               // La figura colisiona con proyectiles (ej. Muro de Sage)
  stoppableInFlight?: boolean;       // Habilidades en movimiento que se pueden detener manualmente (ej. Harbor C)
  generatesSoulOrbs?: boolean;       // Enemigos sueltan orbes al morir o asistir (ej. Reyna/Iso)
  isolatesTarget?: boolean;          // Aísla al objetivo a un "mundo aparte" (ej. Iso X)
}

export interface SkillBehavior {
  charges?: number;
  castTime?: number;
  duration?: number;
  hp?: number;
  rechargeTime?: number;
  rechargeKills?: number;            // Kills necesarias para recargar la habilidad (ej: 2)
  debuffApplied?: string;            // Nombre del debuffo aplicado a enemigos (ej: "Vulnerable")
  spawn: "player" | "ground" | "wall" | "projectile";
  spawnOffset?: number;              // Desplazamiento en metros desde el agente
  maxCastRange?: number;
  groundRange?: number;              // legacy
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

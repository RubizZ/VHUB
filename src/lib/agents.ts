// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

export interface SkillGeometry {
  type: "circle" | "rectangle" | "cone" | "infinite-wall";
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
}

export interface SkillBehavior {
  charges?: number;
  castTime?: number;
  rechargeTime?: number;
  spawn: "player" | "ground" | "wall" | "projectile";
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

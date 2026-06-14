import { z } from "zod";
// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

// --- ECONOMY ---
export interface EconomyData {
  costCredits?: number;
  costUltPoints?: number;
  costNote?: string;
  usesPerRound?: number;
  rechargeCondition?: string;
}

// --- GEOMETRY ---
export type SkillGeometry =
  | { type: 'circle'; radius?: number }
  | { type: 'rectangle'; width?: number; length?: number }
  | { type: 'cone'; radius?: number; angle?: number }
  | { type: 'sector'; radius?: number; angle?: number }
  | { type: 'line'; width?: number; length?: number }
  | { type: 'curve'; width?: number; length?: number }
  | { type: 'trapezoid'; width?: number; endWidth?: number; length?: number }
  | { type: 'cross'; width?: number; length?: number }
  | { type: 'none' };

export const SkillGeometrySchema: z.ZodType<SkillGeometry> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("circle"), radius: z.number().optional() }),
  z.object({ type: z.literal("rectangle"), width: z.number().optional(), length: z.number().optional() }),
  z.object({ type: z.literal("cone"), radius: z.number().optional(), angle: z.number().optional() }),
  z.object({ type: z.literal("sector"), radius: z.number().optional(), angle: z.number().optional() }),
  z.object({ type: z.literal("line"), width: z.number().optional(), length: z.number().optional() }),
  z.object({ type: z.literal("curve"), width: z.number().optional(), length: z.number().optional() }),
  z.object({ type: z.literal("trapezoid"), width: z.number().optional(), endWidth: z.number().optional(), length: z.number().optional() }),
  z.object({ type: z.literal("cross"), width: z.number().optional(), length: z.number().optional() }),
  z.object({ type: z.literal("none") }),
]);

// --- EFFECTS ---
export interface DamageData {
  type?: "burst" | "dot" | "weapon" | "instant" | "decay";
  baseDamage?: number;
  damagePerSecond?: number;
  damagePerPulse?: number;
  pulses?: number;
  ticksPerSecond?: number;
  damageMin?: number;
  damageMax?: number;
  headshotDamage?: number;
  bodyDamage?: number;
  legDamage?: number;
  oneShotBody?: boolean;
}

export interface HealData {
  amount?: number;
  duration?: number;
  selfAmount?: number;
  selfDuration?: number;
  requiresSoulOrb?: boolean;
}

export interface VisionData {
  blocksVision?: boolean;
  nearsight?: boolean;
  flash?: boolean;
  flashDuration?: number;
  reveal?: boolean;
  revealPulses?: number;
}

export interface ActionEffects {
  damage?: DamageData;
  heal?: HealData;
  vision?: VisionData;
  cc?: string[];
  buffs?: string[];
  isolatesTarget?: boolean;
  revives?: boolean;
}

// Zod schemas for effects
const DamageDataSchema: z.ZodType<DamageData> = z.object({
  type: z.enum(["instant", "dot", "decay", "burst", "weapon"]).optional(),
  baseDamage: z.number().optional(),
  damagePerSecond: z.number().optional(),
  damagePerPulse: z.number().optional(),
  pulses: z.number().optional(),
  ticksPerSecond: z.number().optional(),
  damageMin: z.number().optional(),
  damageMax: z.number().optional(),
  headshotDamage: z.number().optional(),
  bodyDamage: z.number().optional(),
  legDamage: z.number().optional(),
  oneShotBody: z.boolean().optional(),
});

const HealDataSchema: z.ZodType<HealData> = z.object({
  amount: z.number().optional(),
  duration: z.number().optional(),
  selfAmount: z.number().optional(),
  selfDuration: z.number().optional(),
  requiresSoulOrb: z.boolean().optional(),
});

const VisionDataSchema: z.ZodType<VisionData> = z.object({
  blocksVision: z.boolean().optional(),
  nearsight: z.boolean().optional(),
  flash: z.boolean().optional(),
  flashDuration: z.number().optional(),
  reveal: z.boolean().optional(),
  revealPulses: z.number().optional(),
});

export const ActionEffectsSchema: z.ZodType<ActionEffects> = z.object({
  damage: DamageDataSchema.optional(),
  heal: HealDataSchema.optional(),
  vision: VisionDataSchema.optional(),
  cc: z.array(z.string()).optional(),
  buffs: z.array(z.string()).optional(),
  isolatesTarget: z.boolean().optional(),
  revives: z.boolean().optional(),
});

// --- DEPLOYMENT ---
export type DeploymentType = 
  | "self_instant" 
  | "self_mobile_aura" 
  | "projectile_terminal_aoe" 
  | "projectile_sweeping" 
  | "map_target_aoe" 
  | "static_deployable" 
  | "linear_wall" 
  | "two_point_barrier" 
  | "equip_weapon";

export type DeploymentMechanics = 
  | { type: "self_instant"; windup?: number; spawnOffset?: number }
  | { type: "self_mobile_aura"; windup?: number; spawnOffset?: number }
  | { type: "projectile_terminal_aoe"; windup?: number; spawnOffset?: number; projectileSpeed?: number; projectileMaxDistance?: number; bounces?: number; steerable?: boolean; traversesWalls?: boolean }
  | { type: "projectile_sweeping"; windup?: number; spawnOffset?: number; projectileSpeed?: number; projectileMaxDistance?: number; traversesWalls?: boolean; sweepEffects?: ActionEffects; geometry?: SkillGeometry }
  | { type: "map_target_aoe"; windup?: number; spawnOffset?: number; castRange?: number }
  | { type: "static_deployable"; windup?: number; spawnOffset?: number; castRange?: number }
  | { type: "linear_wall"; windup?: number; spawnOffset?: number; steerable?: boolean; castRange?: number; traversesWalls?: boolean }
  | { type: "two_point_barrier"; windup?: number; spawnOffset?: number; directionalOnly?: boolean; castRange?: number }
  | { type: "equip_weapon"; windup?: number; spawnOffset?: number; maxAmmo?: number };

const BaseDeploymentSchema = z.object({
  windup: z.number().optional()
});

export const DeploymentMechanicsSchema: z.ZodType<DeploymentMechanics> = z.discriminatedUnion("type", [
  BaseDeploymentSchema.extend({ type: z.literal("self_instant") }),
  BaseDeploymentSchema.extend({ type: z.literal("self_mobile_aura") }),
  BaseDeploymentSchema.extend({ type: z.literal("projectile_terminal_aoe"), projectileSpeed: z.number().optional(), projectileMaxDistance: z.number().optional(), bounces: z.number().optional(), steerable: z.boolean().optional(), traversesWalls: z.boolean().optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("projectile_sweeping"), spawnOffset: z.number().optional(), projectileSpeed: z.number().optional(), projectileMaxDistance: z.number().optional(), traversesWalls: z.boolean().optional(), sweepEffects: ActionEffectsSchema.optional(), geometry: SkillGeometrySchema.optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("map_target_aoe"), castRange: z.number().optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("static_deployable"), castRange: z.number().optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("linear_wall"), steerable: z.boolean().optional(), castRange: z.number().optional(), traversesWalls: z.boolean().optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("two_point_barrier"), directionalOnly: z.boolean().optional(), castRange: z.number().optional() }),
  BaseDeploymentSchema.extend({ type: z.literal("equip_weapon"), maxAmmo: z.number().optional() }),
]);

// --- LIFETIME ---
export interface AutonomousBehavior {
  activationRadius?: number;
  movementSpeed?: number;
}

export interface LifetimeMechanics {
  duration?: number;
  destructible?: { hp: number };
  behavior?: "static" | "autonomous" | "mobile_aura";
  autonomous?: AutonomousBehavior;
  geometry?: SkillGeometry; // Form/Area during active phase
  effects?: ActionEffects; // Ticking effects or constant effects
  pulses?: number;
  audioCueRadius?: number;
  notes?: string;
  recollectable?: boolean;
  fuelBased?: boolean;
}

export const LifetimeMechanicsSchema: z.ZodType<LifetimeMechanics> = z.object({
  duration: z.number().optional(),
  destructible: z.object({ hp: z.number() }).optional(),
  behavior: z.enum(["static", "autonomous", "mobile_aura"]).optional(),
  autonomous: z.object({
    activationRadius: z.number().optional(),
    movementSpeed: z.number().optional()
  }).optional(),
  geometry: SkillGeometrySchema.optional(),
  effects: ActionEffectsSchema.optional(),
  pulses: z.number().optional(),
  audioCueRadius: z.number().optional(),
  notes: z.string().optional(),
  recollectable: z.boolean().optional(),
  fuelBased: z.boolean().optional()
});

// --- RESOLUTION ---
export interface ResolutionMechanics {
  trigger?: "on_impact" | "on_timer" | "on_recast" | "on_death";
  geometry?: SkillGeometry; // Explosion area
  effects?: ActionEffects;
}

export const ResolutionMechanicsSchema: z.ZodType<ResolutionMechanics> = z.object({
  trigger: z.enum(["on_impact", "on_timer", "on_recast", "on_death"]).optional(),
  geometry: SkillGeometrySchema.optional(),
  effects: ActionEffectsSchema.optional()
});

// --- BASE AGENT SKILL ---
export interface AgentSkill {
  id: string;
  agentId: string;
  key: string;
  name: string;
  description: string | null;
  type: "Basic" | "Signature" | "Ultimate" | "Passive";
  color: string | null;
  displayIcon?: string;
  enabled?: boolean;
  
  economy?: EconomyData | null;
  deployment: DeploymentMechanics;
  lifetime?: LifetimeMechanics | null;
  resolution?: ResolutionMechanics | null;
}

export const EconomyDataSchema: z.ZodType<EconomyData> = z.object({
  costCredits: z.number().optional(),
  costUltPoints: z.number().optional(),
  costNote: z.string().optional(),
  usesPerRound: z.number().optional(),
  rechargeCondition: z.string().optional(),
});

export const AgentSkillUpdateSchema = z.object({
  agentId: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  type: z.string().optional(),
  displayIcon: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  economy: EconomyDataSchema.optional().nullable(),
  deployment: DeploymentMechanicsSchema,
  lifetime: LifetimeMechanicsSchema.optional().nullable(),
  resolution: ResolutionMechanicsSchema.optional().nullable(),
}).refine(data => data.lifetime || data.resolution, {
  message: "La habilidad debe tener al menos una fase de Vida Útil o de Resolución.",
  path: ["lifetime"]
});

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

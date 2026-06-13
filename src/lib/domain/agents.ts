import { z } from "zod";
// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

// --- ECONOMY ---
export interface EconomyData {
  costCredits?: number;
  costUltPoints?: number;
  costNote?: string;
  usesPerRound?: number;
  rechargeCondition?: string; // e.g. "2 kills", "Left-click only", "40s cooldown"
}

// --- MECHANICS (Discriminated Union) ---
export type BaseMechanics<T extends string> = {
  deploymentType: T;
  windup?: number;
  duration?: number; // duration of the effect or life of the entity
}

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

export type MechanicsData = 
  | (BaseMechanics<"self_instant"> & { geometry?: never })
  | (BaseMechanics<"self_mobile_aura"> & { geometry?: SkillGeometry; pulses?: number; traversesWalls?: boolean })
  | (BaseMechanics<"projectile_terminal_aoe"> & { geometry?: SkillGeometry; projectileSpeed?: number; projectileMaxDistance?: number; bounces?: number; steerable?: boolean; traversesWalls?: boolean })
  | (BaseMechanics<"projectile_sweeping"> & { geometry?: SkillGeometry; projectileSpeed?: number; projectileMaxDistance?: number; traversesWalls?: boolean })
  | (BaseMechanics<"map_target_aoe"> & { geometry?: SkillGeometry; mapRadiusUnits?: number; castRange?: number })
  | (BaseMechanics<"static_deployable"> & { geometry?: SkillGeometry; castRange?: number })
  | (BaseMechanics<"linear_wall"> & { geometry?: SkillGeometry; steerable?: boolean; castRange?: number; traversesWalls?: boolean })
  | (BaseMechanics<"two_point_barrier"> & { geometry?: SkillGeometry; directionalOnly?: boolean; castRange?: number })
  | (BaseMechanics<"equip_weapon"> & { geometry?: never; maxAmmo?: number })
  | (BaseMechanics<"autonomous_entity"> & { geometry?: SkillGeometry; activationRadius?: number; movementSpeed?: number });

export type DeploymentType = MechanicsData["deploymentType"];

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
  blocksVision?: boolean; // Smokes, walls
  nearsight?: boolean;
  flash?: boolean;
  flashDuration?: number;
  reveal?: boolean;
  revealPulses?: number;
}

export interface EffectsData {
  damage?: DamageData;
  heal?: HealData;
  vision?: VisionData;
  cc?: string[]; // E.g. "Vulnerable 2.5s", "Concuss 2.5s"
  buffs?: string[]; // E.g. "+10% Equip speed"
  destructible?: { hp: number }; // Only if it can be destroyed
  isolatesTarget?: boolean;
  revives?: boolean;
  notes?: string;
  recollectable?: boolean; // e.g. Killjoy turret, Viper orb
  fuelBased?: boolean; // e.g. Viper fuel
  audioCueRadius?: number;
}

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
  
  economy?: EconomyData;
  mechanics: MechanicsData;
  effects?: EffectsData;
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

// --- ZOD SCHEMAS ---
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

const BaseMechanicsSchema = z.object({
  windup: z.number().optional(),
  duration: z.number().optional(),
});

export const MechanicsDataSchema: z.ZodType<MechanicsData> = z.discriminatedUnion("deploymentType", [
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("self_instant"),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("self_mobile_aura"),
    geometry: SkillGeometrySchema.optional(),
    pulses: z.number().optional(),
    traversesWalls: z.boolean().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("projectile_terminal_aoe"),
    geometry: SkillGeometrySchema.optional(),
    projectileSpeed: z.number().optional(),
    projectileMaxDistance: z.number().optional(),
    bounces: z.number().optional(),
    steerable: z.boolean().optional(),
    traversesWalls: z.boolean().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("projectile_sweeping"),
    geometry: SkillGeometrySchema.optional(),
    projectileSpeed: z.number().optional(),
    projectileMaxDistance: z.number().optional(),
    traversesWalls: z.boolean().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("map_target_aoe"),
    geometry: SkillGeometrySchema.optional(),
    mapRadiusUnits: z.number().optional(),
    castRange: z.number().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("static_deployable"),
    geometry: SkillGeometrySchema.optional(),
    castRange: z.number().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("linear_wall"),
    geometry: SkillGeometrySchema.optional(),
    steerable: z.boolean().optional(),
    castRange: z.number().optional(),
    traversesWalls: z.boolean().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("two_point_barrier"),
    geometry: SkillGeometrySchema.optional(),
    directionalOnly: z.boolean().optional(),
    castRange: z.number().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("equip_weapon"),
    maxAmmo: z.number().optional(),
  }),
  BaseMechanicsSchema.extend({
    deploymentType: z.literal("autonomous_entity"),
    geometry: SkillGeometrySchema.optional(),
    activationRadius: z.number().optional(),
    movementSpeed: z.number().optional(),
  }),
]);

export const EconomyDataSchema: z.ZodType<EconomyData> = z.object({
  costCredits: z.number().optional(),
  costUltPoints: z.number().optional(),
  costNote: z.string().optional(),
  usesPerRound: z.number().optional(),
  rechargeCondition: z.string().optional(),
});

export const EffectsDataSchema: z.ZodType<EffectsData> = z.object({
  damage: z.object({
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
  }).optional(),
  heal: z.object({
    amount: z.number().optional(),
    duration: z.number().optional(),
    selfAmount: z.number().optional(),
    selfDuration: z.number().optional(),
    requiresSoulOrb: z.boolean().optional(),
  }).optional(),
  vision: z.object({
    blocksVision: z.boolean().optional(),
    nearsight: z.boolean().optional(),
    flash: z.boolean().optional(),
    flashDuration: z.number().optional(),
    reveal: z.boolean().optional(),
    revealPulses: z.number().optional(),
  }).optional(),
  destructible: z.object({
    hp: z.number(),
  }).optional(),
  cc: z.array(z.string()).optional(),
  buffs: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isolatesTarget: z.boolean().optional(),
  revives: z.boolean().optional(),
  recollectable: z.boolean().optional(),
  fuelBased: z.boolean().optional(),
  audioCueRadius: z.number().optional(),
});

export const AgentSkillUpdateSchema = z.object({
  agentId: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  type: z.string().optional(),
  displayIcon: z.string().optional(),
  enabled: z.boolean().optional(),
  economy: EconomyDataSchema.optional(),
  mechanics: MechanicsDataSchema.optional(),
  effects: EffectsDataSchema.optional(),
});

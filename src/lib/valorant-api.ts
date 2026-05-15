import { ValorantApi } from '@valpro-labs/valorant-api';

/**
 * Singleton instance of the ValorantApi client for static assets.
 * Service provided by https://valorant-api.com
 */
export const valorantApi = new ValorantApi({
  language: 'es-ES' // Default to Spanish as per project context
});

// Helper types for common assets
export type { 
  AgentResponse as AgentV1Response,
  MapResponse as MapV1Response,
  WeaponResponse as WeaponV1Response 
} from '@valpro-labs/valorant-api';

/**
 * Fetch all maps dynamically from the API.
 */
export async function getMaps() {
  return await valorantApi.mapsEndpoints.getMapsV1();
}

/**
 * Fetch all agents dynamically from the API.
 */
export async function getAgents() {
  return await valorantApi.agentsEndpoints.getAgentsV1();
}

/**
 * Fetch all competitive tiers (ranks).
 */
export async function getCompetitiveTiers() {
  return await valorantApi.competitiveTiersEndpoints.getCompetitiveTiersV1();
}

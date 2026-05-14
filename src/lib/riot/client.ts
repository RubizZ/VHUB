import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { 
  RiotAccount, ValMatch, Matchlist, ValContent, PlatformStatus, 
  ValorantRegion, ValorantShard, RoutingRegion, GetMatchlistParams, 
  GetMatchParams, GetAccountParams, GetContentParams 
} from './types';
import { 
  RateLimitError, ForbiddenError, NotFoundError, 
  ServiceUnavailableError, RiotApiError 
} from './errors';

// Redis setup for distributed rate limiting (Serverless friendly)
const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiter: 20 requests per 1 second (Riot Dev Key limit)
const ratelimit = redis 
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(20, "1 s"),
      analytics: true,
      prefix: "@upstash/ratelimit/riot-api",
    })
  : null;

export class RiotApiClient {
  private readonly apiKey: string;
  private readonly region: ValorantRegion;
  private readonly shard: ValorantShard;
  private readonly routing: RoutingRegion;

  constructor(apiKey: string, region: ValorantRegion = 'eu') {
    this.apiKey = apiKey;
    this.region = region;
    this.shard = this.getShard(region);
    this.routing = this.getRouting(region);
  }

  private async fetchWithRetry<T>(url: string, options: RequestInit = {}, retries = 3): Promise<T> {
    // 1. Check Distributed Rate Limit (Upstash)
    if (ratelimit) {
      const { success, reset } = await ratelimit.limit("global");
      if (!success) {
        const waitTime = reset - Date.now();
        if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
      }
    } else {
      // Fallback: Local simple throttling for dev
      await new Promise(r => setTimeout(r, 60)); // ~16 req/s safe margin
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'X-Riot-Token': this.apiKey,
        },
      });

      if (response.ok) {
        return await response.json() as T;
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const wait = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
        
        if (retries > 0) {
          await new Promise(r => setTimeout(r, wait));
          return this.fetchWithRetry(url, options, retries - 1);
        }
        throw new RateLimitError(wait);
      }

      if (response.status === 403) throw new ForbiddenError();
      if (response.status === 404) throw new NotFoundError(url);
      if (response.status >= 500) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return this.fetchWithRetry(url, options, retries - 1);
        }
        throw new ServiceUnavailableError();
      }

      throw new RiotApiError(`API returned ${response.status}`, response.status);
    } catch (error) {
      if (error instanceof RiotApiError) throw error;
      throw new RiotApiError(error instanceof Error ? error.message : 'Network error', 0);
    }
  }

  // --- Endpoints ---

  async getAccount(name: string, tag: string): Promise<RiotAccount> {
    const url = `https://${this.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    return this.fetchWithRetry<RiotAccount>(url);
  }

  async getMatchlist(puuid: string): Promise<Matchlist> {
    const url = `https://${this.region}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${puuid}`;
    return this.fetchWithRetry<Matchlist>(url);
  }

  async getMatch(matchId: string): Promise<ValMatch> {
    const url = `https://${this.region}.api.riotgames.com/val/match/v1/matches/${matchId}`;
    return this.fetchWithRetry<ValMatch>(url);
  }

  async getContent(locale?: string): Promise<ValContent> {
    const url = `https://${this.region}.api.riotgames.com/val/content/v1/contents${locale ? `?locale=${locale}` : ''}`;
    return this.fetchWithRetry<ValContent>(url);
  }

  async getPlatformStatus(): Promise<PlatformStatus> {
    const url = `https://${this.region}.api.riotgames.com/val/status/v1/platform-data`;
    return this.fetchWithRetry<PlatformStatus>(url);
  }

  // --- Helpers ---

  private getShard(region: ValorantRegion): ValorantShard {
    const mapping: Record<string, ValorantShard> = { eu: 'eu', na: 'na', ap: 'ap', kr: 'kr', latam: 'na', br: 'na' };
    return mapping[region] || 'eu';
  }

  private getRouting(region: ValorantRegion): RoutingRegion {
    if (region === 'eu') return 'europe';
    if (region === 'ap' || region === 'kr') return 'asia';
    return 'americas';
  }
}

// Singleton factory
let client: RiotApiClient | null = null;

export function getRiotClient() {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return null;
  
  if (!client) {
    client = new RiotApiClient(apiKey, (process.env.VALORANT_REGION as ValorantRegion) || 'eu');
  }
  return client;
}

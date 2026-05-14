import type {
  RiotAccount,
  ValMatch,
  Matchlist,
  RecentMatches,
  ValContent,
  Leaderboard,
  PlatformStatus,
  ValorantRegion,
  ValorantShard,
  RoutingRegion,
  QueueType,
} from './types';
import {
  RiotApiError,
  RateLimitError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from './errors';

/** Maps Valorant region to the API shard */
const REGION_TO_SHARD: Record<ValorantRegion, ValorantShard> = {
  eu: 'eu',
  na: 'na',
  ap: 'ap',
  kr: 'kr',
  latam: 'na',
  br: 'na',
};

/** Maps Valorant region to the account routing region */
const REGION_TO_ROUTING: Record<ValorantRegion, RoutingRegion> = {
  eu: 'europe',
  na: 'americas',
  ap: 'asia',
  kr: 'asia',
  latam: 'americas',
  br: 'americas',
};

interface ClientOptions {
  apiKey: string;
  region: ValorantRegion;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class RiotApiClient {
  private readonly apiKey: string;
  private readonly shard: ValorantShard;
  private readonly routing: RoutingRegion;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  private requestTimestamps: number[] = [];
  private readonly rateLimitWindow = 1000; // 1 second
  private readonly rateLimitMax = 18; // under the 20/s dev limit

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.shard = REGION_TO_SHARD[options.region];
    this.routing = REGION_TO_ROUTING[options.region];
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
  }

  // --- Core HTTP ---

  private get valBaseUrl(): string {
    return `https://${this.shard}.api.riotgames.com`;
  }

  private get accountBaseUrl(): string {
    return `https://${this.routing}.api.riotgames.com`;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (t) => now - t < this.rateLimitWindow
    );
    if (this.requestTimestamps.length >= this.rateLimitMax) {
      const oldest = this.requestTimestamps[0];
      const waitMs = this.rateLimitWindow - (now - oldest) + 50;
      await new Promise((r) => setTimeout(r, waitMs));
    }
    this.requestTimestamps.push(Date.now());
  }

  private async request<T>(url: string, retryCount = 0): Promise<T> {
    await this.throttle();

    const response = await fetch(url, {
      headers: {
        'X-Riot-Token': this.apiKey,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    const body = await response.text().catch(() => '');

    switch (response.status) {
      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        if (retryCount < this.maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfter * 1000));
          return this.request<T>(url, retryCount + 1);
        }
        throw new RateLimitError(retryAfter);
      }
      case 403:
        throw new ForbiddenError();
      case 404:
        throw new NotFoundError(url);
      case 503:
      case 500: {
        if (retryCount < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, retryCount);
          await new Promise((r) => setTimeout(r, delay));
          return this.request<T>(url, retryCount + 1);
        }
        throw new ServiceUnavailableError();
      }
      default:
        throw new RiotApiError(
          `Riot API error ${response.status}: ${body}`,
          response.status,
          undefined,
          body
        );
    }
  }

  // --- Account V1 ---

  async getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
    return this.request<RiotAccount>(
      `${this.accountBaseUrl}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );
  }

  async getAccountByPuuid(puuid: string): Promise<RiotAccount> {
    return this.request<RiotAccount>(
      `${this.accountBaseUrl}/riot/account/v1/accounts/by-puuid/${puuid}`
    );
  }

  // --- VAL-MATCH-V1 ---

  async getMatch(matchId: string): Promise<ValMatch> {
    return this.request<ValMatch>(
      `${this.valBaseUrl}/val/match/v1/matches/${matchId}`
    );
  }

  async getMatchlist(puuid: string): Promise<Matchlist> {
    return this.request<Matchlist>(
      `${this.valBaseUrl}/val/match/v1/matchlists/by-puuid/${puuid}`
    );
  }

  async getRecentMatches(queue: QueueType): Promise<RecentMatches> {
    return this.request<RecentMatches>(
      `${this.valBaseUrl}/val/match/v1/recent-matches/by-queue/${queue}`
    );
  }

  // --- VAL-CONTENT-V1 ---

  async getContent(locale?: string): Promise<ValContent> {
    const params = locale ? `?locale=${locale}` : '';
    return this.request<ValContent>(
      `${this.valBaseUrl}/val/content/v1/contents${params}`
    );
  }

  // --- VAL-RANKED-V1 ---

  async getLeaderboard(
    actId: string,
    size?: number,
    startIndex?: number
  ): Promise<Leaderboard> {
    const params = new URLSearchParams();
    if (size !== undefined) params.set('size', size.toString());
    if (startIndex !== undefined) params.set('startIndex', startIndex.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<Leaderboard>(
      `${this.valBaseUrl}/val/ranked/v1/leaderboards/by-act/${actId}${qs}`
    );
  }

  // --- VAL-STATUS-V1 ---

  async getPlatformStatus(): Promise<PlatformStatus> {
    return this.request<PlatformStatus>(
      `${this.valBaseUrl}/val/status/v1/platform-data`
    );
  }
}

// --- Singleton factory ---
let _client: RiotApiClient | null = null;

export function getRiotClient(): RiotApiClient | null {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return null;

  if (!_client) {
    _client = new RiotApiClient({
      apiKey,
      region: (process.env.VALORANT_REGION as ValorantRegion) || 'eu',
    });
  }
  return _client;
}

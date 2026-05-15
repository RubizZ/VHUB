import axios, { AxiosRequestConfig } from 'axios';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const HENRIK_API_KEY = process.env.HENRIK_API_KEY;

const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const henrikRateLimit = redis 
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "@vhub/ratelimit/henrik",
    })
  : null;

export const henrikAxiosInstance = async <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  // Check Distributed Rate Limit
  if (henrikRateLimit) {
    const { success, reset } = await henrikRateLimit.limit("global");
    if (!success) {
      const wait = Math.max(0, reset - Date.now());
      if (wait < 3000) {
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw new Error(`Rate limit hit, reset in ${wait}ms`);
      }
    }
  }

  const source = axios.CancelToken.source();
  const promise = axios({
    ...config,
    ...options,
    baseURL: 'https://api.henrikdev.xyz', // Set base URL here
    headers: {
      ...config.headers,
      ...options?.headers,
      ...(HENRIK_API_KEY ? { Authorization: HENRIK_API_KEY } : {}),
    },
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@shelflife_recipe_cache_';
const CACHE_INDEX_KEY = '@shelflife_recipe_cache_index';
const MAX_CACHE_ENTRIES = 50;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheIndexEntry {
  key: string;
  createdAt: number;
}

function hashParams(params: Record<string, string | undefined>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildCacheKey(endpoint: string, params: Record<string, string | undefined>): string {
  return `${CACHE_PREFIX}${endpoint}_${hashParams(params)}`;
}

async function getCacheIndex(): Promise<CacheIndexEntry[]> {
  const stored = await AsyncStorage.getItem(CACHE_INDEX_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function evictOldest(): Promise<void> {
  const index = await getCacheIndex();
  if (index.length <= MAX_CACHE_ENTRIES) return;

  // Sort by createdAt ascending (oldest first)
  index.sort((a, b) => a.createdAt - b.createdAt);

  const toRemove = index.splice(0, index.length - MAX_CACHE_ENTRIES);
  await Promise.all(toRemove.map((entry) => AsyncStorage.removeItem(entry.key)));
  await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
}

export async function getCached<T>(
  endpoint: string,
  params: Record<string, string | undefined>
): Promise<T | null> {
  const key = buildCacheKey(endpoint, params);

  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  endpoint: string,
  params: Record<string, string | undefined>,
  data: T,
  ttlMs: number
): Promise<void> {
  const key = buildCacheKey(endpoint, params);

  const entry: CacheEntry<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));

    // Update index
    const index = await getCacheIndex();
    const existing = index.findIndex((e) => e.key === key);
    if (existing >= 0) {
      index[existing].createdAt = Date.now();
    } else {
      index.push({ key, createdAt: Date.now() });
    }
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));

    await evictOldest();
  } catch {
    // Cache write failure is non-critical
  }
}

// TTL constants
export const SEARCH_CACHE_TTL = 60 * 60 * 1000; // 1 hour
export const DETAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

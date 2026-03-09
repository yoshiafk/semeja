const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Request deduplication: coalesce identical in-flight GET requests
const inflight = new Map<string, Promise<any>>();
// Short-lived cache: avoids re-fetching on quick page navigations
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5_000; // 5 seconds

async function fetchJSON<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    const error: any = new Error(errorData.error || `HTTP error! status: ${response.status}`);
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    // Return cached data if still fresh
    const hit = cache.get(path);
    if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T;

    // Deduplicate concurrent requests to the same path
    if (inflight.has(path)) return inflight.get(path) as Promise<T>;

    const promise = fetchJSON<T>(path, options).then((data) => {
      cache.set(path, { data, ts: Date.now() });
      return data;
    }).finally(() => inflight.delete(path));

    inflight.set(path, promise);
    return promise;
  }

  // Mutations: fire request and invalidate the entire cache
  const data = await fetchJSON<T>(path, options);
  cache.clear();
  return data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: any) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

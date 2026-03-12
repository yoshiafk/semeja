const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Request deduplication: coalesce identical in-flight GET requests
const inflight = new Map<string, Promise<any>>();
// Short-lived cache: avoids re-fetching on quick page navigations
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5_000; // 5 seconds

async function fetchJSON<T>(path: string, options: RequestInit): Promise<T> {
  const token = localStorage.getItem('semeja_auth_token');
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
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
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Types for member summary
export interface MemberSummary {
  member: {
    id: number;
    name: string;
    role: 'superadmin' | 'admin' | 'member';
  };
  currentWeek: {
    mealPlanId: number;
    weekLabel: string;
    daysJoined: number;
    estimatedCost: number;
    actualCost: number;
    activityCost?: number;
    dailyBreakdown: Array<{
      date: string;
      dayName: string;
      costPerPerson: number;
    }>;
  } | null;
  history: {
    totalWeeks: number;
    totalCost: number;
    totalDays: number;
    averageWeekly: number;
  };
}

// Get member-specific summary for Profile page
export const getMemberSummary = (memberId: number) => 
  api.get<MemberSummary>(`/summary/member/${memberId}`);

// Get today's participation count
export const getTodayParticipation = async (): Promise<{ count: number; mealId: number | null }> => {
  try {
    const plans = await api.get<any[]>('/meal-plans/active');
    if (!plans || plans.length === 0) return { count: 0, mealId: null };
    
    const today = new Date().toISOString().split('T')[0];
    const meals = await api.get<any[]>(`/meals/${plans[0].id}`);
    const todayMeal = meals?.find(m => m.date === today);
    
    if (!todayMeal) return { count: 0, mealId: null };
    
    const participations = await api.get<any[]>(`/participations/${plans[0].id}`);
    const todayCount = participations?.filter(p => p.meal_id === todayMeal.id).length || 0;
    
    return { count: todayCount, mealId: todayMeal.id };
  } catch {
    return { count: 0, mealId: null };
  }
};
// Types for Gift feature
export interface Gift {
  id: number;
  title: string;
  description: string;
  event_date: string | null;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  created_by: number;
  creator_name?: string;
  created_at: string;
  participant_count?: number;
  total_estimated_price?: number;
}

export interface GiftItem {
  id: number;
  gift_id: number;
  name: string;
  estimated_price: number;
  actual_price: number;
  url: string;
  status: 'needed' | 'bought';
  created_at: string;
}

export interface GiftParticipant {
  id: number;
  gift_id: number;
  member_id: number;
  member_name: string;
  contribution_amount: number;
  joined_at: string;
}

export interface GiftDetail extends Gift {
  items: GiftItem[];
  participants: GiftParticipant[];
}

// Gift API functions
export const getGifts = () => api.get<Gift[]>('/gifts');
export const getGiftDetail = (id: number) => api.get<GiftDetail>(`/gifts/${id}`);
export const createGift = (data: Partial<Gift>) => api.post<Gift>('/gifts', data);
export const updateGift = (id: number, data: Partial<Gift>) => api.put<Gift>(`/gifts/${id}`, data);
export const deleteGift = (id: number) => api.delete<{ message: string; gift: Gift }>(`/gifts/${id}`);
export const addGiftItem = (giftId: number, data: Partial<GiftItem>) => api.post<GiftItem>(`/gifts/${giftId}/items`, data);
export const updateGiftItem = (giftId: number, itemId: number, data: Partial<GiftItem>) => api.put<GiftItem>(`/gifts/${giftId}/items/${itemId}`, data);
export const deleteGiftItem = (giftId: number, itemId: number) => api.delete<{ message: string }>(`/gifts/${giftId}/items/${itemId}`);
export const joinGift = (giftId: number, data: { member_id: number; contribution_amount?: number }) => api.post<GiftParticipant>(`/gifts/${giftId}/join`, data);
export const leaveGift = (giftId: number, data: { member_id: number }) => api.post<{ message: string }>(`/gifts/${giftId}/leave`, data);

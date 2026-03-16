import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";

export type CostType = "free" | "fixed" | "split";

export interface ActivityParticipation {
  id: number;
  activity_id: number;
  member_id: number;
  guests_count: number;
  payment_status: "unpaid" | "paid";
  created_at: string;
  member_name?: string;
}

export interface ActivityItem {
  id: number;
  activity_id: number;
  name: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface Activity {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  cost_type: CostType;
  cost_amount: number;
  max_participants: number | null;
  created_by: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled" | "archived";
  receipt_id?: number | null;
  created_at: string;
  
  // Aggregate fields from API
  participant_count?: number;
  guests_count_total?: number;
  
  // Detail fields
  participants?: ActivityParticipation[];
  items?: ActivityItem[];
}

interface ActivityContextType {
  activities: Activity[];
  loading: boolean;
  fetchActivities: () => Promise<void>;
  fetchActivity: (id: number) => Promise<Activity>;
  createActivity: (activity: Partial<Activity>) => Promise<Activity>;
  updateActivity: (id: number, activity: Partial<Activity>) => Promise<Activity>;
  joinActivity: (id: number, memberId: number, guestsCount?: number) => Promise<void>;
  leaveActivity: (id: number, memberId: number) => Promise<void>;
  deleteActivity: (id: number) => Promise<void>;
  recordActivityItems: (id: number, items: any[]) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Activity[]>("/activities");
      setActivities(data);
    } catch (err) {
      console.error("Failed to fetch activities", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const fetchActivity = async (id: number) => {
    return await api.get<Activity>(`/activities/${id}`);
  };

  const createActivity = async (activity: Partial<Activity>) => {
    const newActivity = await api.post<Activity>("/activities", activity);
    await fetchActivities();
    return newActivity;
  };

  const updateActivity = async (id: number, activity: Partial<Activity>) => {
    const updated = await api.put<Activity>(`/activities/${id}`, activity);
    await fetchActivities();
    return updated;
  };

  const joinActivity = async (id: number, memberId: number, guestsCount: number = 0) => {
    await api.post(`/activities/${id}/join`, { member_id: memberId, guests_count: guestsCount });
    await fetchActivities();
  };

  const leaveActivity = async (id: number, memberId: number) => {
    await api.post(`/activities/${id}/leave`, { member_id: memberId });
    await fetchActivities();
  };

  const deleteActivity = async (id: number) => {
    await api.delete(`/activities/${id}`);
    await fetchActivities();
  };

  const recordActivityItems = async (id: number, items: any[]) => {
    await api.post(`/activities/${id}/items`, { items });
    await fetchActivities();
  };

  const value: ActivityContextType = {
    activities,
    loading,
    fetchActivities,
    fetchActivity,
    createActivity,
    updateActivity,
    joinActivity,
    leaveActivity,
    deleteActivity,
    recordActivityItems
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error("useActivity must be used within an ActivityProvider");
  }
  return context;
}

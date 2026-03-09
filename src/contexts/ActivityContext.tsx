import { createContext, useContext } from "react";
import type { ReactNode } from "react";

// TODO: Activity types and interfaces will be defined here
// when the Activities feature is implemented

interface Activity {
  id: number;
  title: string;
  type: "running" | "badminton" | "gym" | "other";
  date: string;
  time: string;
  location: string;
  maxParticipants: number;
  participants: number[];
  createdBy: number;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
}

interface ActivityContextType {
  activities: Activity[];
  loading: boolean;
  // TODO: Add methods for CRUD operations
  // createActivity: (activity: Omit<Activity, 'id'>) => Promise<Activity>;
  // joinActivity: (activityId: number) => Promise<void>;
  // leaveActivity: (activityId: number) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ children }: { children: ReactNode }) {
  // TODO: Implement activity state management
  // This is a placeholder for the upcoming Activities feature
  
  const value: ActivityContextType = {
    activities: [],
    loading: false,
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

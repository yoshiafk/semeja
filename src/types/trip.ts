// ── Trip Module Types ─────────────────────────────────────────────────────

export type ActivityType =
  | 'food'
  | 'attraction'
  | 'transit'
  | 'hotel'
  | 'event'
  | 'shopping'
  | 'leisure';

export type TripStatus = 'upcoming' | 'on_trip' | 'done';
export type TripCity = 'semarang' | 'yogyakarta' | 'transit';

export interface ScheduleItem {
  id: number;
  day_id: number;
  time_start: string;
  time_end: string;
  name: string;
  activity_type: ActivityType;
  location: string;
  area: string;
  maps_url: string;
  notes: string;
  opening_hours: string;
  is_highlight: boolean;
  is_cash_only: boolean;
  requires_booking: boolean;
  is_optional: boolean;
  sort_order: number;
  is_done?: boolean;
}

export interface TripDay {
  id: number;
  day_number: number;
  date: string;
  label: string;
  city: TripCity;
  area_note: string;
  warning_note: string;
  schedule: ScheduleItem[];
}

export interface HotelDistance {
  destination: string;
  distance_km: string;
  duration: string;
}

export interface TripHotel {
  id: number;
  name: string;
  city: string;
  address: string;
  maps_url: string;
  check_in: string;
  check_out: string;
  sort_order: number;
  distances: HotelDistance[];
}

export interface TripBudgetRow {
  id: number;
  category: string;
  detail: string;
  amount_rp: number;
  actual_amount_rp: number;
  is_accommodation: boolean;
  is_total_row: boolean;
}

export interface TripParticipant {
  id: number;
  name: string;
  avatar_url: string;
  joined_at: string;
}

export interface TripSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  start_date: string;
  end_date: string;
  status: TripStatus;
  participant_count: number;
  transport: string[];
  pace: string;
  cover_city: string;
}

export interface TripPackingItem {
  id: number;
  category: string;
  item_name: string;
  is_checked: boolean;
  assignee_id: number | null;
  assignee_name?: string;
}

export interface TripDetail extends TripSummary {
  hotels: TripHotel[];
  days: TripDay[];
  budget: TripBudgetRow[];
  participants: { id: number; name: string; avatar_url: string; joined_at: string }[];
  packing: TripPackingItem[];
}

import { useMemo } from "react";
import type { TripStatus } from "@/types/trip";

interface TripCountdownBannerProps {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  status: TripStatus;
  className?: string;
}

function computeCountdown(startDate: string, endDate: string): {
  label: string;
  sublabel: string;
  variant: "upcoming" | "active" | "done";
} {
  const now = new Date();
  
  // Safely handle both YYYY-MM-DD and full ISO strings
  const parseToMidnight = (dateStr: string) => {
    const yyyymmdd = dateStr.split('T')[0];
    return new Date(yyyymmdd + "T00:00:00");
  };

  const start = parseToMidnight(startDate);
  const end = parseToMidnight(endDate);
  
  // Set end date to 23:59:59 of that day
  end.setHours(23, 59, 59, 999);

  if (now > end) {
    return { label: "Selesai ✓", sublabel: "Trip sudah selesai", variant: "done" };
  }
  if (now >= start) {
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const daysPassed = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
    return {
      label: `Hari ke-${daysPassed} dari ${totalDays}`,
      sublabel: "Sedang berlangsung 🎉",
      variant: "active",
    };
  }
  const daysLeft = Math.ceil((start.getTime() - now.getTime()) / 86400000);
  if (daysLeft === 1) return { label: "Besok berangkat!", sublabel: "Satu hari lagi 🚀", variant: "upcoming" };
  return { label: `${daysLeft} hari lagi`, sublabel: "Hitung mundur keberangkatan ✈️", variant: "upcoming" };
}

const VARIANT_STYLES = {
  upcoming: "bg-info/10 border-info/20 text-info",
  active: "bg-success/10 border-success/20 text-success",
  done: "bg-muted border-border text-muted-foreground",
};

const DOT_STYLES = {
  upcoming: "bg-info",
  active: "bg-success animate-pulse",
  done: "bg-muted-foreground",
};

export function TripCountdownBanner({ startDate, endDate, className = "" }: TripCountdownBannerProps) {
  const { label, sublabel, variant } = useMemo(
    () => computeCountdown(startDate, endDate),
    [startDate, endDate]
  );

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${VARIANT_STYLES[variant]} ${className}`}>
      <span className={`size-2 rounded-full flex-shrink-0 ${DOT_STYLES[variant]}`} />
      <span>{label}</span>
      <span className="font-normal text-xs opacity-75 hidden sm:inline">· {sublabel}</span>
    </div>
  );
}

/** Larger variant for use on trip list card */
export function TripCountdownBlock({ startDate, endDate }: TripCountdownBannerProps) {
  const { label, sublabel, variant } = useMemo(
    () => computeCountdown(startDate, endDate),
    [startDate, endDate]
  );

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${VARIANT_STYLES[variant]}`}>
      <span className={`size-3 rounded-full flex-shrink-0 ${DOT_STYLES[variant]}`} />
      <div>
        <p className="font-bold text-base leading-tight">{label}</p>
        <p className="text-xs opacity-75">{sublabel}</p>
      </div>
    </div>
  );
}

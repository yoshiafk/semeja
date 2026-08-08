import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TripDay, TripCity } from "@/types/trip";
import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

interface TripDaySelectorProps {
  days: TripDay[];
  activeDay: number;
  onSelectDay: (dayNumber: number) => void;
}

const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getDayAbbr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_ABBR[d.getDay()];
}

export function TripDaySelector({ days, activeDay, onSelectDay }: TripDaySelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Group days by consecutive cities
  const grouped = days.reduce((acc, day) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.city === day.city) {
      lastGroup.days.push(day);
    } else {
      acc.push({ city: day.city, days: [day] });
    }
    return acc;
  }, [] as { city: TripCity; days: TripDay[] }[]);

  // Auto-scroll active chip into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeDay]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-hide scroll-smooth snap-x snap-mandatory"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {grouped.map((group, groupIdx) => (
        <div key={`${group.city}-${groupIdx}`} className="flex flex-col gap-1.5 snap-start shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest pl-2">
            {group.city}
          </span>
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
            {group.days.map((day) => {
              const isActive = day.day_number === activeDay;

              return (
                <button
                  key={day.day_number}
                  ref={isActive ? activeRef : null}
                  onClick={() => {
                    triggerHaptic("light");
                    onSelectDay(day.day_number);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center w-14 h-12 rounded-lg transition-colors z-10",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  )}
                >
                  {/* Sliding Active Background */}
                  {isActive && (
                    <motion.div
                      layoutId="active-day-pill"
                      className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      style={{ zIndex: -1 }}
                    />
                  )}

                  <span className={cn("text-sm font-bold", isActive ? "text-foreground" : "text-muted-foreground")}>
                    H{day.day_number}
                  </span>
                  <span className={cn("text-[10px] uppercase tracking-wider font-semibold", isActive ? "text-foreground/70" : "text-muted-foreground/70")}>
                    {getDayAbbr(day.date)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TripDay, TripCity } from "@/types/trip";

interface TripDaySelectorProps {
  days: TripDay[];
  activeDay: number;
  cityFilter: TripCity | "all";
  onSelectDay: (dayNumber: number) => void;
}

const CITY_DOT: Record<TripCity | "transit", string> = {
  semarang: "bg-green-500",
  yogyakarta: "bg-purple-500",
  transit: "bg-gradient-to-r from-green-500 to-purple-500",
};

const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function getDayAbbr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_ABBR[d.getDay()];
}

export function TripDaySelector({ days, activeDay, cityFilter, onSelectDay }: TripDaySelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Auto-scroll active chip into view
  useEffect(() => {
    const chip = chipRefs.current.get(activeDay);
    if (chip && scrollRef.current) {
      chip.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeDay]);

  const visibleDays = cityFilter === "all"
    ? days
    : days.filter(d => d.city === cityFilter || d.city === "transit");

  return (
    <div
      ref={scrollRef}
      className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto pb-1 px-1 md:pr-2 scrollbar-hide scroll-smooth -mx-1 md:mx-0 max-h-[calc(100vh-200px)]"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {visibleDays.map((day) => {
        const isActive = day.day_number === activeDay;
        const dotStyle = CITY_DOT[day.city] ?? "bg-gray-400";

        return (
          <button
            key={day.day_number}
            ref={(el) => { if (el) chipRefs.current.set(day.day_number, el); }}
            onClick={() => onSelectDay(day.day_number)}
            className={cn(
              "flex-shrink-0 flex flex-col md:flex-row items-center md:justify-start justify-center w-14 h-16 md:w-full md:h-12 md:px-4 rounded-xl border transition-all duration-200 gap-0.5 md:gap-3",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-md md:scale-100 scale-105"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5 active:scale-95 md:hover:scale-[1.02]"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 md:mb-0 mb-0.5",
              isActive ? "bg-primary-foreground/70" : dotStyle
            )} />
            <div className="flex flex-col md:flex-row md:items-center md:justify-between md:flex-1 md:gap-2">
              <span className={cn("text-xs md:text-sm font-bold text-center md:text-left", isActive ? "text-primary-foreground" : "text-foreground")}>
                H{day.day_number}
              </span>
              <span className={cn("text-[10px] md:text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {getDayAbbr(day.date)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

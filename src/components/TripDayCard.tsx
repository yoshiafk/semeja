import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripDay } from "@/types/trip";
import { TripScheduleItem } from "./TripScheduleItem";
import { WhatsAppShareButton } from "./WhatsAppShareButton";
import { formatTripDayWhatsApp } from "@/lib/whatsapp";

interface TripDayCardProps {
  day: TripDay;
  tripTitle: string;
  defaultExpanded?: boolean;
}

const CITY_COLORS: Record<string, string> = {
  semarang: "bg-green-500",
  yogyakarta: "bg-purple-500",
  transit: "bg-gradient-to-r from-green-500 to-purple-500",
};

export function TripDayCard({ day, tripTitle, defaultExpanded = false }: TripDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dotClass = CITY_COLORS[day.city] || "bg-gray-400";

  return (
    <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-md mb-6 hover:shadow-lg transition-shadow duration-300" id={`day-${day.day_number}`}>
      {/* Header (Tap to toggle) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-5 flex items-center justify-between text-left active:bg-muted/50 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
          <div>
            <h3 className="font-bold text-foreground">
              H{day.day_number} · {day.label}
            </h3>
            {/* If there was an area subtitle we'd show it here, currently it's just in the day object but maybe we can derive from schedule or area_note */}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            {/* Banners */}
            {day.warning_note && (
              <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#fff8eb] text-amber-900 text-sm flex items-start gap-2 border border-[#ffe0b2]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <p className="leading-snug">{day.warning_note}</p>
              </div>
            )}
            
            {day.area_note && (
              <div className="mb-3 px-3 py-2.5 rounded-xl bg-sky-50 text-sky-900 text-sm flex items-start gap-2 border border-sky-100">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-600" />
                <p className="leading-snug">{day.area_note}</p>
              </div>
            )}

            {/* Schedule Items */}
            <div className="flex flex-col">
              {day.schedule.map((item, idx) => (
                <TripScheduleItem
                  key={item.id}
                  item={item}
                  isLast={idx === day.schedule.length - 1}
                />
              ))}
              {day.schedule.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground italic">
                  Belum ada jadwal
                </div>
              )}
            </div>

            {/* Share button */}
            <div className="mt-4 pt-4 border-t">
              <WhatsAppShareButton
                message={formatTripDayWhatsApp(day, tripTitle)}
                label="Bagikan jadwal hari ini"
                className="w-full justify-center"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

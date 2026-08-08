import { Copy, ExternalLink, MapPin, Building } from "lucide-react";
import { toast } from "sonner";
import type { TripHotel } from "@/types/trip";

export function TripHotelCard({ hotel }: { hotel: TripHotel }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(hotel.address);
    toast.success("Alamat disalin!");
  };

  const checkInDate = new Date(hotel.check_in).toLocaleDateString("en-GB", {
    day: "numeric", month: "short"
  });
  const checkOutDate = new Date(hotel.check_out).toLocaleDateString("en-GB", {
    day: "numeric", month: "short"
  });

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm mb-4 p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
          <Building className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-lg">{hotel.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hotel.city} · Check-in {checkInDate} → {checkOutDate}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex gap-2 items-start">
          <MapPin className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <button 
              onClick={handleCopy}
              className="text-left text-sm hover:opacity-80 transition-opacity active:scale-[0.98] group flex gap-2 items-start"
            >
              <span className="leading-relaxed">{hotel.address}</span>
              <Copy className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
            </button>
          </div>
        </div>

        {hotel.maps_url && (
          <div className="mt-3 flex justify-end">
            <a 
              href={hotel.maps_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              Buka Maps <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {hotel.distances && hotel.distances.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-muted-foreground mb-2">Jarak ke area wisata:</p>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <tbody className="divide-y">
                {hotel.distances.map((dist, i) => (
                  <tr key={i} className={i % 2 === 1 ? "bg-muted/30" : "bg-transparent"}>
                    <td className="py-2.5 px-3 font-medium">{dist.destination}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{dist.distance_km}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-right">{dist.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

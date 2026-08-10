import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { TripDetail } from "@/types/trip";

interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: TripDetail;
  onSave: (data: Partial<TripDetail>) => Promise<void>;
}

export function TripFormDialog({ open, onOpenChange, trip, onSave }: TripFormDialogProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coverCity, setCoverCity] = useState("");
  const [pace, setPace] = useState("");
  const [transport, setTransport] = useState<string>("");
  const [participantCount, setParticipantCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (trip) {
        setTitle(trip.title);
        setSubtitle(trip.subtitle || "");
        setStartDate(trip.start_date.substring(0, 10));
        setEndDate(trip.end_date.substring(0, 10));
        setCoverCity(trip.cover_city || "");
        setPace(trip.pace || "");
        setTransport(trip.transport ? trip.transport.join(", ") : "");
        setParticipantCount(trip.participant_count || 1);
      } else {
        setTitle("");
        setSubtitle("");
        setStartDate("");
        setEndDate("");
        setCoverCity("");
        setPace("");
        setTransport("");
        setParticipantCount(1);
      }
    }
  }, [open, trip]);

  const handleSave = async () => {
    if (!title || !startDate || !endDate) return;
    setIsSubmitting(true);
    
    const transportArr = transport.split(",").map(s => s.trim()).filter(Boolean);
    
    const data: Partial<TripDetail> = {
      title,
      subtitle,
      start_date: startDate,
      end_date: endDate,
      cover_city: coverCity,
      pace,
      transport: transportArr,
      participant_count: participantCount
    };

    try {
      await onSave(data);
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95%] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{trip ? "Edit Trip Master" : "Buat Trip Baru"}</DialogTitle>
          <DialogDescription className="text-xs">
            {trip ? "Ubah detail perjalanan dan atur siapa saja yang ikut." : "Buat rencana perjalanan baru."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Judul Perjalanan *</Label>
            <input
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Cth: Roadtrip Jawa Tengah"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Subjudul</Label>
            <input
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Cth: Semarang - Solo - Jogja"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Tanggal Berangkat *</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Tanggal Pulang *</Label>
              <input
                type="date"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Cover Kota (Optional)</Label>
            <input
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Cth: semarang"
              value={coverCity}
              onChange={e => setCoverCity(e.target.value)}
            />
          </div>
          
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Transportasi (Pisahkan koma)</Label>
            <input
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Cth: Kereta Api, Mobil Sewa"
              value={transport}
              onChange={e => setTransport(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5 mt-2">
            <Label className="text-sm font-bold">Jumlah Peserta</Label>
            <p className="text-xs text-muted-foreground mb-2">Total orang yang ikut trip ini (mempengaruhi pembagian budget rata-rata).</p>
            <input
              type="number"
              min="1"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={participantCount}
              onChange={e => setParticipantCount(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl w-full sm:w-auto" disabled={isSubmitting}>
            Batal
          </Button>
          <Button 
            className="rounded-xl w-full sm:w-auto" 
            disabled={!title || !startDate || !endDate || isSubmitting}
            onClick={handleSave}
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Trip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

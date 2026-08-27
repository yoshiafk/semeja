// @ts-nocheck
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Save, MapPin, Clock, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { getTripDetail, addTripScheduleItem, updateTripScheduleItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TripDetail, ActivityType } from "@/types/trip";
import { triggerHaptic } from "@/lib/haptics";

const ACTIVITY_TYPES = [
  { value: "food", label: "Makanan & Resto" },
  { value: "attraction", label: "Tempat Wisata" },
  { value: "transit", label: "Transportasi" },
  { value: "hotel", label: "Penginapan" },
  { value: "event", label: "Event / Acara" },
  { value: "shopping", label: "Belanja" },
  { value: "leisure", label: "Waktu Luang" }
];

export default function ScheduleForm() {
  const { slug, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dayIdParam = searchParams.get("dayId");
  
  const isEditing = Boolean(itemId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState<TripDetail | null>(null);

  // Form State
  const [dayId, setDayId] = useState<number>(dayIdParam ? parseInt(dayIdParam) : 0);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [name, setName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("attraction");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [isHighlight, setIsHighlight] = useState(false);
  const [isCashOnly, setIsCashOnly] = useState(false);
  const [requiresBooking, setRequiresBooking] = useState(false);
  const [isOptional, setIsOptional] = useState(false);

  useEffect(() => {
    if (!slug) return;
    
    getTripDetail(slug)
      .then(res => {
        setTrip(res);
        if (isEditing) {
          const item = res.days.flatMap((d: any) => d.schedule).find((s: any) => s.id === parseInt(itemId!));
          if (item) {
            setDayId(item.day_id);
            setTimeStart(item.time_start ? item.time_start.replace('.', ':').substring(0, 5) : "");
            setTimeEnd(item.time_end ? item.time_end.replace('.', ':').substring(0, 5) : "");
            setName(item.name);
            setActivityType(item.activity_type);
            setLocation(item.location || "");
            setArea(item.area || "");
            setMapsUrl(item.maps_url || "");
            setNotes(item.notes || "");
            setOpeningHours(item.opening_hours || "");
            setIsHighlight(item.is_highlight || false);
            setIsCashOnly(item.is_cash_only || false);
            setRequiresBooking(item.requires_booking || false);
            setIsOptional(item.is_optional || false);
          } else {
            toast.error("Jadwal tidak ditemukan");
            navigate(`/trips/${slug}`);
          }
        } else {
          // Defaults for new
          if (!dayIdParam && res.days.length > 0) {
            setDayId(res.days[0].id);
          }
        }
      })
      .catch(err => {
        console.error("Failed to load trip:", err);
        toast.error("Gagal memuat detail perjalanan");
      })
      .finally(() => setLoading(false));
  }, [slug, itemId, isEditing, navigate, dayIdParam]);

  const handleSave = async () => {
    if (!slug || !dayId || !timeStart || !name || !activityType) {
      toast.error("Mohon lengkapi Waktu Mulai, Nama, dan Kategori");
      return;
    }
    
    triggerHaptic("medium");
    setSaving(true);
    
    const payload = {
      day_id: dayId,
      time_start: timeStart,
      time_end: timeEnd,
      name,
      activity_type: activityType,
      location,
      area,
      maps_url: mapsUrl,
      notes,
      opening_hours: openingHours,
      is_highlight: isHighlight,
      is_cash_only: isCashOnly,
      requires_booking: requiresBooking,
      is_optional: isOptional
    };

    try {
      if (isEditing) {
        await updateTripScheduleItem(slug, parseInt(itemId!), payload);
        toast.success("Jadwal berhasil diperbarui");
      } else {
        await addTripScheduleItem(slug, payload);
        toast.success("Jadwal berhasil ditambahkan");
      }
      // Bust the react-query cache so detail page shows fresh data immediately
      queryClient.invalidateQueries({ queryKey: ['trip', slug] });
      navigate(`/trips/${slug}`);
    } catch (err) {
      console.error("Failed to save schedule:", err);
      toast.error("Gagal menyimpan jadwal");
      setSaving(false);
    }
  };

  if (loading || !trip) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-24 animate-page-in">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { triggerHaptic("light"); navigate(-1); }}
              className="p-2 -ml-2 rounded-full hover:bg-muted active:scale-95 transition-all"
            >
              <ChevronLeft className="size-5" />
            </button>
            <h1 className="font-bold text-lg">{isEditing ? "Edit Jadwal" : "Agenda Baru"}</h1>
          </div>
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={saving}
            className="h-8 rounded-lg shadow-none"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4 mr-1.5" />}
            {saving ? "Menyimpan" : "Simpan"}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {/* Inti */}
          <div className="bg-card border rounded-3xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <h2 className="font-bold">Informasi Inti</h2>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="dayId">Pilih Hari</Label>
            <Select value={dayId.toString()} onValueChange={(val) => setDayId(parseInt(val))}>
              <SelectTrigger id="dayId" className="rounded-xl h-11 bg-muted/50 border-0">
                <SelectValue placeholder="Pilih hari perjalanan..." />
              </SelectTrigger>
              <SelectContent>
                {trip.days.map(d => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    H{d.day_number} - {d.label} ({d.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="timeStart">Waktu Mulai <span className="text-destructive">*</span></Label>
              <Input 
                id="timeStart"
                type="time" 
                value={timeStart} 
                onChange={(e) => setTimeStart(e.target.value)} 
                className="rounded-xl h-11 bg-muted/50 border-0"
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="timeEnd">Waktu Selesai <span className="text-muted-foreground font-normal">(Opsional)</span></Label>
              <Input 
                id="timeEnd"
                type="time" 
                value={timeEnd} 
                onChange={(e) => setTimeEnd(e.target.value)} 
                className="rounded-xl h-11 bg-muted/50 border-0"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="name">Nama Kegiatan <span className="text-destructive">*</span></Label>
            <Input 
              id="name"
              placeholder="Contoh: Makan Siang di Gudeg Yu Djum"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="rounded-xl h-11 bg-muted/50 border-0"
              required
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="activityType">Kategori <span className="text-destructive">*</span></Label>
            <Select value={activityType} onValueChange={(val: any) => setActivityType(val)}>
              <SelectTrigger id="activityType" className="rounded-xl h-11 bg-muted/50 border-0">
                <SelectValue placeholder="Pilih kategori..." />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lokasi */}
        <div className="bg-card border rounded-3xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <MapPin className="size-4" />
            </div>
            <h2 className="font-bold">Lokasi & Maps</h2>
          </div>

          <div className="space-y-3">
            <Label htmlFor="mapsUrl">Link Google Maps</Label>
            <Input 
              id="mapsUrl"
              placeholder="https://maps.app.goo.gl/..."
              value={mapsUrl} 
              onChange={(e) => setMapsUrl(e.target.value)} 
              className="rounded-xl h-11 bg-muted/50 border-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="location">Nama Tempat</Label>
              <Input 
                id="location"
                placeholder="Gudeg Yu Djum Wijilan"
                value={location} 
                onChange={(e) => setLocation(e.target.value)} 
                className="rounded-xl h-11 bg-muted/50 border-0"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="area">Area / Daerah</Label>
              <Input 
                id="area"
                placeholder="Kraton, Jogja"
                value={area} 
                onChange={(e) => setArea(e.target.value)} 
                className="rounded-xl h-11 bg-muted/50 border-0"
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="openingHours">Jam Buka / Operasional</Label>
            <Input 
              id="openingHours"
              placeholder="06.00 - 22.00"
              value={openingHours} 
              onChange={(e) => setOpeningHours(e.target.value)} 
              className="rounded-xl h-11 bg-muted/50 border-0"
            />
          </div>
        </div>

        {/* Catatan & Penanda */}
        <div className="bg-card border rounded-3xl p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <AlignLeft className="size-4" />
            </div>
            <h2 className="font-bold">Catatan & Penanda</h2>
          </div>

          <div className="space-y-3">
            <Label htmlFor="notes">Catatan Khusus</Label>
            <Textarea 
              id="notes"
              placeholder="Contoh: Pesan meja atas nama Budi, parkir di seberang..."
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="rounded-xl min-h-[100px] bg-muted/50 border-0 resize-none"
            />
          </div>

          <div className="pt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isHighlight" className="text-base">Highlight Utama (⭐)</Label>
                <p className="text-xs text-muted-foreground">Tandai sebagai agenda penting</p>
              </div>
              <Switch id="isHighlight" checked={isHighlight} onCheckedChange={setIsHighlight} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isCashOnly" className="text-base">Cash Only (💵)</Label>
                <p className="text-xs text-muted-foreground">Tempat ini hanya menerima tunai</p>
              </div>
              <Switch id="isCashOnly" checked={isCashOnly} onCheckedChange={setIsCashOnly} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="requiresBooking" className="text-base">Perlu Booking (📌)</Label>
                <p className="text-xs text-muted-foreground">Wajib reservasi sebelumnya</p>
              </div>
              <Switch id="requiresBooking" checked={requiresBooking} onCheckedChange={setRequiresBooking} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isOptional" className="text-base">Opsional</Label>
                <p className="text-xs text-muted-foreground">Agenda ini bisa dilewati</p>
              </div>
              <Switch id="isOptional" checked={isOptional} onCheckedChange={setIsOptional} />
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}


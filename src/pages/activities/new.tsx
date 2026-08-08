import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useActivity } from "@/contexts/ActivityContext";
import type { CostType } from "@/contexts/ActivityContext";
import { useMember } from "@/hooks/useMember";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, Tag, Users, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function NewActivity() {
  const { createActivity } = useActivity();
  const { member } = useMember();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    cost_type: "free" as CostType,
    cost_amount: "",
    max_participants: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    try {
      setLoading(true);
      await createActivity({
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: `${formData.time}:00`,
        location: formData.location,
        cost_type: formData.cost_type,
        cost_amount: formData.cost_type === "free" ? 0 : Number(formData.cost_amount),
        max_participants: formData.max_participants ? Number(formData.max_participants) : null,
        created_by: member.id,
        status: "upcoming"
      });
      
      toast.success("Aktifitas berhasil dibuat!");
      navigate("/activities");
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat aktifitas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Buat Aktifitas</h1>
          <p className="text-sm text-muted-foreground">Isi detail lengkap kegiatan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-20">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Nama Kegiatan *</label>
          <input
            type="text"
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            placeholder="Contoh: Futsal Bareng"
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Deskripsi</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Detail kegiatan, rute, dll..."
            rows={3}
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Calendar className="size-4 text-muted-foreground" /> Tanggal *
            </label>
            <input
              type="date"
              name="date"
              required
              value={formData.date}
              onChange={handleChange}
              className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-1">
              <Clock className="size-4 text-muted-foreground" /> Jam *
            </label>
            <input
              type="time"
              name="time"
              required
              value={formData.time}
              onChange={handleChange}
              className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-1">
            <MapPin className="size-4 text-muted-foreground" /> Lokasi
          </label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Contoh: Lapangan SCBD"
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-1">
            <Tag className="size-4 text-muted-foreground" /> Jenis Biaya *
          </label>
          <select
            name="cost_type"
            required
            value={formData.cost_type}
            onChange={handleChange}
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
          >
            <option value="free">Gratis</option>
            <option value="fixed">Harga Pas (Per Orang)</option>
            <option value="split">Bagi Rata (Dibagi Nanti)</option>
          </select>
        </div>

        {formData.cost_type !== "free" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              {formData.cost_type === "fixed" ? "Harga Per Orang (Rp)" : "Estimasi/Total Biaya Sementara (Rp)"}
            </label>
            <input
              type="number"
              name="cost_amount"
              required
              min="0"
              value={formData.cost_amount}
              onChange={handleChange}
              placeholder="0"
              className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-1">
            <Users className="size-4 text-muted-foreground" /> Batas Peserta (Opsional)
          </label>
          <input
            type="number"
            name="max_participants"
            min="1"
            value={formData.max_participants}
            onChange={handleChange}
            placeholder="Biarkan kosong jika tanpa batas"
            className="w-full p-3 rounded-xl border border-border bg-card text-foreground"
          />
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? <Loader2 className="size-5 animate-spin" /> : "Buat Aktifitas"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

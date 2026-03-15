import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useActivity } from "@/contexts/ActivityContext";
import type { Activity } from "@/contexts/ActivityContext";
import { useMember } from "@/hooks/useMember";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { MapPin, Users, Calendar, Clock, ArrowLeft, Loader2, Info, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { Receipt } from "lucide-react";

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchActivity, joinActivity, leaveActivity, updateActivity, deleteActivity } = useActivity();
  const { member, isAdmin } = useMember();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [guestsCount, setGuestsCount] = useState(0);

  useEffect(() => {
    if (id) {
      loadActivity();
    }
  }, [id]);

  const loadActivity = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchActivity(Number(id));
      setActivity(data);
    } catch (error) {
      toast.error("Gagal memuat detail aktifitas");
      navigate("/activities");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!activity) return null;

  const dateObj = new Date(activity.date);
  const isJoined = activity.participants?.some(p => p.member_id === member?.id);
  const myParticipation = activity.participants?.find(p => p.member_id === member?.id);
  
  const currentTotalParticipants = (activity.participants?.length || 0) + (activity.participants?.reduce((sum, p) => sum + p.guests_count, 0) || 0);
  const isFull = activity.max_participants ? currentTotalParticipants >= activity.max_participants : false;

  const handleJoin = async () => {
    if (!member) return;
    try {
      setActionLoading(true);
      await joinActivity(activity.id, member.id, guestsCount);
      toast.success("Berhasil bergabung!");
      await loadActivity(true);
    } catch (error: any) {
      toast.error(error.message || "Gagal bergabung");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!activity) return;
    try {
      setActionLoading(true);
      await updateActivity(activity.id, { status: "archived" });
      toast.success("Aktifitas diarsipkan");
      navigate("/activities");
    } catch (error: any) {
      toast.error(error.message || "Gagal mengarsipkan aktifitas");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;
    if (!confirm("Apakah Anda yakin ingin menghapus aktifitas ini? Hal ini tidak dapat dibatalkan.")) return;
    
    try {
      setActionLoading(true);
      await deleteActivity(activity.id);
      toast.success("Aktifitas dihapus");
      navigate("/activities");
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus aktifitas");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!member) return;
    try {
      setActionLoading(true);
      await leaveActivity(activity.id, member.id);
      toast.success("Berhasil batal bergabung");
      await loadActivity(true);
    } catch (error: any) {
      toast.error(error.message || "Gagal batal bergabung");
    } finally {
      setActionLoading(false);
    }
  };

  let costDisplay = "Gratis";
  if (activity.cost_type === "fixed") costDisplay = `Rp ${activity.cost_amount.toLocaleString('id-ID')} / org`;
  else if (activity.cost_type === "split") costDisplay = "Bagi Rata";

  return (
    <PageContainer>
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground line-clamp-1">{activity.title}</h1>
        </div>
        {(isAdmin || activity.created_by === member?.id) && (
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleArchive} disabled={actionLoading} title="Arsipkan">
              <Archive className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={actionLoading} title="Hapus" className="text-destructive hover:text-destructive">
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6 pb-24">
        {/* Info Card */}
        <div className="p-5 rounded-2xl border border-border/50 bg-card space-y-4 shadow-sm">
          {activity.description && (
            <p className="text-sm text-foreground leading-relaxed">
              {activity.description}
            </p>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{format(dateObj, "EEEE, d MMMM yyyy", { locale: idLocale })}</p>
                <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> {activity.time.substring(0, 5)} WIB</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <p className="font-medium text-foreground">{activity.location || "Lokasi belum ditentukan"}</p>
            </div>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary uppercase tracking-wider mb-0.5">
                  {activity.cost_type === 'free' ? 'Gratis' : activity.cost_type === 'fixed' ? 'Fix Price' : 'Split Bill'}
                </span>
                <p className="font-medium text-foreground">{costDisplay}</p>
              </div>
            </div>

            {/* Receipt Section */}
            {(isAdmin || activity.created_by === member?.id || activity.receipt_id) && (
              <div className="pt-4 border-t border-border/30 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Receipt className="h-3.5 w-3.5" /> Bukti Pembayaran
                  </div>
                  {activity.receipt_id && (
                    <ReceiptPreview 
                      receiptId={activity.receipt_id}
                      digitalData={{
                        title: activity.title,
                        amount: activity.cost_amount,
                        date: activity.date,
                        location: activity.location,
                        notes: activity.description
                      }}
                    />
                  )}
                </div>
                
                {(isAdmin || activity.created_by === member?.id) && (
                  <ReceiptUpload 
                    initialId={activity.receipt_id}
                    onUploadSuccess={async (rid) => {
                      await updateActivity(activity.id, { receipt_id: rid });
                      await loadActivity(true);
                    }}
                    onClear={async () => {
                      await updateActivity(activity.id, { receipt_id: null });
                      await loadActivity(true);
                    }}
                    onScanSuccess={() => {}}
                    label=""
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Participants section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Peserta
            </h3>
            <span className="text-xs text-muted-foreground">
              {currentTotalParticipants} {activity.max_participants ? `/ ${activity.max_participants}` : ''} joined
            </span>
          </div>

          <div className="p-1">
            {activity.participants?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada peserta.</p>
            ) : (
              <ul className="space-y-2">
                {activity.participants?.map(p => (
                  <li key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/30">
                    <span className="font-medium text-sm text-foreground">{p.member_name}</span>
                    {p.guests_count > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                        +{p.guests_count} Tamu
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,8px)+60px)] lg:bottom-4 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t border-border p-4 max-w-lg mx-auto">
        {isJoined ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">Kamu ikut!</p>
              {myParticipation?.guests_count ? <p className="text-muted-foreground text-xs">Membawa {myParticipation.guests_count} tamu</p> : null}
            </div>
            <Button variant="outline" className="text-destructive hover:text-destructive shrink-0 rounded-xl" onClick={handleLeave} disabled={actionLoading}>
              Batal
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1 w-24 shrink-0">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Bawa Tamu?</label>
              <select 
                title="Bawa Tamu?"
                className="w-full text-sm p-2 rounded-lg border border-border bg-card text-foreground"
                value={guestsCount}
                onChange={(e) => setGuestsCount(Number(e.target.value))}
                disabled={isFull || actionLoading}
              >
                <option value={0}>Sendiri</option>
                <option value={1}>+1 Tamu</option>
                <option value={2}>+2 Tamu</option>
                <option value={3}>+3 Tamu</option>
              </select>
            </div>
            <Button 
              className="flex-1 rounded-xl" 
              onClick={handleJoin} 
              disabled={isFull || actionLoading}
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isFull ? "Penuh" : "Ikut")}
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

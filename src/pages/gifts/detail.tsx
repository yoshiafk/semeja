import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Calendar, Users, Plus, Trash2, 
  CheckCircle2, Circle, DollarSign,
  UserPlus, UserMinus, Receipt
} from "lucide-react";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { 
  getGiftDetail, addGiftItem, updateGiftItem, deleteGiftItem, 
  joinGift, leaveGift, deleteGift
} from "@/lib/api";
import type { GiftDetail as GiftDetailType } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn, formatRupiah } from "@/lib/utils";

export default function GiftDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { member } = useMember();
  
  const [gift, setGift] = useState<GiftDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // State for new item form
  const [newItem, setNewItem] = useState({ name: "", estimated_price: "" });
  const [showItemForm, setShowItemForm] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    try {
      const data = await getGiftDetail(parseInt(id));
      setGift(data);
    } catch (error) {
      console.error("Error fetching gift detail:", error);
      toast.error("Failed to load gift details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const isJoined = useMemo(() => {
    return gift?.participants.some(p => p.member_id === member?.id);
  }, [gift, member]);

  const totalEstimated = useMemo(() => {
    return gift?.items.reduce((sum, item) => sum + (item.estimated_price || 0), 0) || 0;
  }, [gift]);

  const costPerPerson = useMemo(() => {
    if (!gift || gift.participants.length === 0) return totalEstimated;
    return totalEstimated / gift.participants.length;
  }, [gift, totalEstimated]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return toast.error("Item name is required");
    
    setSubmitting(true);
    try {
      await addGiftItem(parseInt(id!), {
        name: newItem.name,
        estimated_price: parseInt(newItem.estimated_price) || 0
      });
      toast.success("Item added");
      setNewItem({ name: "", estimated_price: "" });
      setShowItemForm(false);
      fetchDetail();
    } catch (error) {
      toast.error("Failed to add item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Are you sure you want to remove this item?")) return;
    try {
      await deleteGiftItem(parseInt(id!), itemId);
      toast.success("Item removed");
      fetchDetail();
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const toggleItemStatus = async (itemId: number, currentStatus: string) => {
    try {
      await updateGiftItem(parseInt(id!), itemId, {
        status: currentStatus === 'needed' ? 'bought' : 'needed'
      });
      fetchDetail();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleJoin = async () => {
    if (!member) return;
    setSubmitting(true);
    try {
      await joinGift(parseInt(id!), { member_id: member.id });
      toast.success("You joined the gift pooling!");
      fetchDetail();
    } catch (error) {
      toast.error("Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!member) return;
    setSubmitting(true);
    try {
      await leaveGift(parseInt(id!), { member_id: member.id });
      toast.success("You left the gift pooling");
      fetchDetail();
    } catch (error) {
      toast.error("Failed to leave");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGift = async () => {
    if (!confirm("Are you sure you want to permanently delete this gift plan? This action cannot be undone.")) return;
    
    setSubmitting(true);
    try {
      await deleteGift(parseInt(id!));
      toast.success("Gift plan deleted successfully");
      navigate("/community/gifts");
    } catch (error) {
      console.error("Error deleting gift:", error);
      toast.error("Failed to delete gift plan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading details...</p>
      </div>
    );
  }

  if (!gift) return null;

  const formatCurrency = (amount: number) => {
    return formatRupiah(amount);
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full h-10 w-10 bg-white/50 backdrop-blur-sm border border-border/50"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider mb-1 bg-primary/5 text-primary border-primary/20">
            {gift.status}
          </Badge>
          <h1 className="text-2xl font-bold text-foreground truncate">{gift.title}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteGift}
          className="rounded-full h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      <div className="space-y-6 pb-20">
        {/* Info Card */}
        <Card className="p-5 bg-white/50 border-border/50 shadow-sm space-y-4">
          {gift.description && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {gift.description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-4 pt-2 border-t border-border/30">
            {gift.event_date && (
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/40">
                <Calendar className="w-4 h-4 text-primary" />
                {format(new Date(gift.event_date), "MMMM d, yyyy")}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
              <Users className="w-4 h-4 text-primary" />
              {gift.participants.length} Participants
            </div>
          </div>
        </Card>

        {/* Cost Breakdown Card */}
        <Card className="p-5 bg-primary/5 border-primary/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
            <DollarSign className="w-16 h-16" />
          </div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4" />
            Cost Calculation
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Total Estimated</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(totalEstimated)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Per Person</p>
              <p className="text-xl font-black text-primary">{formatCurrency(costPerPerson)}</p>
            </div>
          </div>
          
          <div className="mt-6">
            {isJoined ? (
              <Button 
                variant="outline" 
                className="w-full rounded-2xl h-11 border-red-200 text-red-600 hover:bg-red-50 font-bold"
                onClick={handleLeave}
                disabled={submitting}
              >
                <UserMinus className="w-4 h-4 mr-2" />
                Leave Pooling
              </Button>
            ) : (
              <Button 
                className="w-full rounded-2xl h-11 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20"
                onClick={handleJoin}
                disabled={submitting}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Join & Split Cost
              </Button>
            )}
            <p className="text-[10px] text-center text-muted-foreground mt-2 font-medium italic">
              *Price will automatically split between all joined members
            </p>
          </div>
        </Card>

        {/* Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wide">
              Gift Items
              <Badge variant="secondary" className="rounded-full h-5 min-w-[20px] px-1">{gift.items.filter(i => i.status === 'bought').length}/{gift.items.length}</Badge>
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 rounded-lg text-primary hover:bg-primary/5 font-bold text-xs"
              onClick={() => setShowItemForm(!showItemForm)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Item
            </Button>
          </div>

          {showItemForm && (
            <Card className="p-4 border-dashed border-primary/30 bg-primary/5 mb-4 animate-in slide-in-from-top-2">
              <form onSubmit={handleAddItem} className="space-y-3">
                <Input 
                  placeholder="Item name (e.g. Birthday Cake)" 
                  value={newItem.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewItem({...newItem, name: e.target.value})}
                  className="bg-white border-primary/20 rounded-xl"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Input 
                    type="number"
                    placeholder="Est. Price" 
                    value={newItem.estimated_price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewItem({...newItem, estimated_price: e.target.value})}
                    className="bg-white border-primary/20 rounded-xl w-32"
                  />
                  <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={submitting}>
                    Add
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowItemForm(false)} className="rounded-xl">
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="space-y-2.5">
            {gift.items.length === 0 ? (
              <div className="py-10 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/20">
                <p className="text-xs text-muted-foreground font-medium italic">No items added yet</p>
                <p className="text-[10px] text-primary mt-1 font-bold">Add item to start splitting costs</p>
              </div>
            ) : (
              gift.items.map((item) => (
                <div 
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                    item.status === 'bought' 
                      ? "bg-green-50/50 border-green-100 opacity-80" 
                      : "bg-white border-border/50"
                  )}
                >
                  <button 
                    onClick={() => toggleItemStatus(item.id, item.status)}
                    className={cn(
                      "p-1 rounded-full transition-colors",
                      item.status === 'bought' ? "text-green-500" : "text-muted-foreground/30 hover:text-primary/40"
                    )}
                  >
                    {item.status === 'bought' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", item.status === 'bought' && "line-through text-muted-foreground")}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2">
                       <p className="text-xs text-muted-foreground font-bold">
                        {formatCurrency(item.estimated_price)}
                      </p>
                      {item.receipt_id && (
                        <ReceiptPreview 
                          receiptId={item.receipt_id}
                          digitalData={{
                            title: item.name,
                            amount: item.estimated_price,
                            date: item.created_at,
                            notes: `Keperluan: ${gift.title}`
                          }}
                          trigger={
                            <button className="text-[10px] text-primary flex items-center gap-1 hover:underline font-bold">
                              <Receipt className="h-3 w-3" /> Lihat Struk
                            </button>
                          }
                        />
                      )}
                    </div>
                  </div>

                  {item.status === 'bought' && (
                    <ReceiptUpload 
                      className="w-auto"
                      initialId={item.receipt_id}
                      onUploadSuccess={async (rid) => {
                        await updateGiftItem(parseInt(id!), item.id, { receipt_id: rid });
                        fetchDetail();
                      }}
                      onClear={async () => {
                        await updateGiftItem(parseInt(id!), item.id, { receipt_id: null });
                        fetchDetail();
                      }}
                    />
                  )}

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-8 w-8 text-muted-foreground/50 hover:text-red-500 rounded-full"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Participants Table */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground px-1 uppercase tracking-wide">
            Participants ({gift.participants.length})
          </h2>
          <Card className="overflow-hidden border-border/50 bg-white shadow-sm">
            <div className="divide-y divide-border/30">
              {gift.participants.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  Be the first to join!
                </div>
              ) : (
                gift.participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {p.member_name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-foreground truncate max-w-[120px]">
                        {p.member_name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Contribution</p>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(costPerPerson)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Textarea from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Gift, Calendar, Save, Loader2 } from "lucide-react";
import { createGift } from "@/lib/api";
import { toast } from "sonner";

export default function NewGift() {
  const navigate = useNavigate();
  const { member } = useMember();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return toast.error("Please enter a title");
    
    setLoading(true);
    try {
      await createGift({
        ...formData,
        created_by: member?.id
      });
      toast.success("Gift plan created successfully!");
      navigate("/community/gifts");
    } catch (error) {
      console.error("Error creating gift:", error);
      toast.error("Failed to create gift plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full h-10 w-10 bg-white/50 backdrop-blur-sm border border-border/50"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Gift Plan</h1>
          <p className="text-sm text-muted-foreground font-medium">Create a gift pooling for an event</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 bg-white/50 backdrop-blur-sm border-border/50 shadow-sm space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="title" className="text-sm font-bold flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              Gift Title
            </Label>
            <Input
              id="title"
              placeholder="e.g. Birthday Gift for Sarah"
              value={formData.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
              className="rounded-xl h-12 bg-white/50 border-border/50 focus:border-primary/50"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="description" className="text-sm font-bold">About the Gift</Label>
            <Textarea
              id="description"
              placeholder="Provide some details about the gift pooling plan..."
              rows={4}
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              className="rounded-xl bg-white/50 border-border/50 resize-none focus:border-primary/50"
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="event_date" className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Event Date (Optional)
            </Label>
            <Input
              id="event_date"
              type="date"
              value={formData.event_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, event_date: e.target.value })}
              className="rounded-xl h-12 bg-white/50 border-border/50 focus:border-primary/50"
            />
          </div>
        </Card>

        <div className="pt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-2xl h-12 font-bold text-muted-foreground border-border/50"
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 rounded-2xl h-12 font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Create Plan
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

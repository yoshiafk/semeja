import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { useMember } from "@/hooks/useMember";
import { cn, formatDate, formatDayName, formatShortDate } from "@/lib/utils";
import { Loader2, Plus, Check, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlanStatusBadge } from "@/components/PlanStatusBadge";
import { RSVPCountdown } from "@/components/RSVPCountdown";
import { DailyBriefingCard } from "@/components/DailyBriefingCard";

interface MealMenuItem {
  id: number;
  recipe_id: number | null;
  custom_name: string;
  category: 'main' | 'second' | 'dessert';
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  items: MealMenuItem[];
  participant_count: number;
  requires_rice: boolean;
}

interface MealPlan {
  id: number;
  week_start: string;
  week_end: string;
  status: string;
  rsvp_deadline?: string | null;
  meals: Meal[];
}

export default function Dashboard() {
  const { member } = useMember();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [participations, setParticipations] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingMeals, setTogglingMeals] = useState<number[]>([]);

  useEffect(() => {
    fetchActivePlans();
  }, [member]);

  useEffect(() => {
    if (selectedPlanId) {
       const selected = plans.find(p => p.id.toString() === selectedPlanId);
       if (selected) {
         setPlan(selected);
         fetchParticipations(selected.id);
       }
    }
  }, [selectedPlanId, plans]);

  const fetchActivePlans = async () => {
    try {
      setLoading(true);
      const activePlans = await api.get<MealPlan[]>("/meal-plans/active");
      setPlans(activePlans);
      if (activePlans.length > 0) {
        setSelectedPlanId(activePlans[0].id.toString());
      } else {
        setPlan(null);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipations = async (planId: number) => {
    if (!member) return;
    try {
      const userParts = await api.get<any[]>(`/participations/${planId}`);
      const mealIds = userParts
        .filter((p) => p.member_id === member?.id)
        .map((p) => p.meal_id);
      setParticipations(mealIds);
    } catch (err) {
      console.error("Failed to fetch participations:", err);
    }
  };

  const toggleJoin = async (mealId: number) => {
    if (!member) return;
    const isJoined = participations.includes(mealId);
    setTogglingMeals(prev => [...prev, mealId]);
    try {
      if (isJoined) {
        await api.delete(`/participations/${mealId}/${member.id}`);
        setParticipations(participations.filter((id) => id !== mealId));
      } else {
        await api.post("/participations", { meal_id: mealId, member_id: member.id });
        setParticipations([...participations, mealId]);
      }
      if (plan) {
        setPlan({
          ...plan,
          meals: plan.meals.map(m =>
            m.id === mealId
              ? { ...m, participant_count: parseInt(m.participant_count as any) + (isJoined ? -1 : 1) }
              : m
          )
        });
      }
    } catch (err: any) {
      const code = err?.data?.code;
      if (code === 'RSVP_LOCKED') {
        toast.error('Pendaftaran sudah ditutup', { description: 'Hubungi admin untuk perubahan' });
      } else if (code === 'DEADLINE_PASSED') {
        const dl = err?.data?.deadline
          ? new Date(err.data.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : '';
        toast.error('Batas waktu RSVP sudah lewat', { description: `Deadline: ${dl}` });
      } else {
        toast.error('Gagal mengubah keikutsertaan');
      }
      console.error("Failed to toggle participation:", err);
    } finally {
      setTogglingMeals(prev => prev.filter(id => id !== mealId));
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!plan) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-3 px-8">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-muted-foreground/70" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Belum ada menu pekan ini</h2>
            <p className="text-sm text-muted-foreground/70 mt-1">Tunggu admin buat jadwalnya ya!</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const joinedCount = participations.length;
  const totalMeals = plan.meals.length;

  return (
    <PageContainer>
      <div className="space-y-5">
        {/* Page Header — compact on mobile, expanded on desktop */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Menu Mingguan</h1>
              <p className="text-sm text-muted-foreground/70 mt-0.5">
                {formatDate(plan.week_start)} — {formatDate(plan.week_end)}
              </p>
            </div>
            {plans.length > 1 && (
              <Select value={selectedPlanId || ""} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="h-9 w-auto gap-1.5 bg-secondary border-border/50 rounded-lg font-medium text-xs text-muted-foreground shadow-none px-3">
                  <SelectValue placeholder="Pekan" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} className="text-sm">
                      {formatDate(p.week_start)} {p.id === plans[0].id ? '(Ini)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quick Stats Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            <div className="flex-shrink-0 flex items-center gap-1.5 bg-primary/8 text-primary px-3 py-1.5 rounded-lg">
              <Check className="h-3.5 w-3.5 stroke-[2.5px]" />
              <span className="text-xs font-semibold">{joinedCount}/{totalMeals} hari ikut</span>
            </div>
            <PlanStatusBadge status={plan.status} className="flex-shrink-0" />
            {plan.rsvp_deadline && ['proposed', 'active'].includes(plan.status) && (
              <RSVPCountdown deadline={plan.rsvp_deadline} />
            )}
          </div>
        </div>

        {/* Meal Cards — single column on mobile for native feel, grid on desktop */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 md:gap-4">
          {plan.meals.map((meal) => {
            const isJoined = participations.includes(meal.id);
            const isToggling = togglingMeals.includes(meal.id);
            const isToday = meal.date === today;
            
            return (
              <div
                key={meal.id}
                className={cn(
                  "bg-white rounded-2xl border transition-all duration-200 overflow-hidden touch-active",
                  isToday ? "border-primary/20 shadow-sm shadow-primary/5" : "border-border/50",
                  isJoined && "ring-1 ring-primary/10"
                )}
              >
                {/* Day Header */}
                <div className={cn(
                  "flex items-center justify-between px-4 py-3",
                  isToday ? "bg-primary/4" : "bg-secondary/60"
                )}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[15px] font-semibold text-foreground">{formatDayName(meal.date)}</span>
                    {isToday && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Hari Ini</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground/70 font-medium">{formatShortDate(meal.date)}</span>
                </div>

                {/* Menu Content */}
                <div className="px-4 py-3 space-y-2.5">
                  {/* Main Course */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Lauk</span>
                      <div className="space-y-0.5">
                        {meal.items?.filter(i => i.category === 'main').length > 0 ? (
                          meal.items.filter(i => i.category === 'main').map((it, idx) => (
                            <p key={idx} className="text-sm font-medium text-foreground leading-snug">{it.custom_name}</p>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground/40 italic">Belum ditentukan</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sayur */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Sayur</span>
                      <div className="space-y-0.5">
                        {meal.items?.filter(i => i.category === 'second').length > 0 ? (
                          meal.items.filter(i => i.category === 'second').map((it, idx) => (
                            <p key={idx} className="text-sm font-medium text-foreground leading-snug">{it.custom_name}</p>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground/40 italic">Belum ditentukan</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dessert */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Dessert</span>
                      <div className="space-y-0.5">
                        {meal.items?.filter(i => i.category === 'dessert').length > 0 ? (
                          meal.items.filter(i => i.category === 'dessert').map((it, idx) => (
                            <p key={idx} className="text-sm font-medium text-foreground leading-snug">{it.custom_name}</p>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground/40 italic">Belum ditentukan</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {Boolean(meal.requires_rice) && (
                    <span className="inline-block text-[10px] font-medium text-muted-foreground/70 bg-secondary px-2 py-0.5 rounded-md">+ Nasi Putih</span>
                  )}
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30">
                  <span className="text-xs text-muted-foreground/70">
                    <span className="font-semibold text-muted-foreground">{meal.participant_count}</span> orang ikut
                  </span>
                  <Button
                    size="sm"
                    variant={isJoined ? "default" : "outline"}
                    className={cn(
                      "h-9 px-4 rounded-xl text-xs font-semibold transition-all",
                      isJoined
                        ? "bg-primary hover:bg-primary/90 shadow-none"
                        : "border-border text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20",
                      !isJoined && (!meal.items || meal.items.length === 0) && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={isToggling || (!isJoined && (!meal.items || meal.items.length === 0))}
                    onClick={() => toggleJoin(meal.id)}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isJoined ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 stroke-[2.5px]" />
                        Ikut!
                      </>
                    ) : (!meal.items || meal.items.length === 0) ? (
                      <>
                        Menu Kosong
                      </>
                    ) : (
                      <>
                        <Plus className="mr-1.5 h-3.5 w-3.5 stroke-[2px]" />
                        Gabung
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily Briefing — only for active/shopping plans */}
        {['active', 'shopping'].includes(plan.status) && (
          <DailyBriefingCard
            meals={plan.meals}
            onStartLogging={(mealId) => navigate(`/finance/costs?meal=${mealId}`)}
          />
        )}
      </div>
    </PageContainer>
  );
}

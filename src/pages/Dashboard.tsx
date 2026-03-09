import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { useMember } from "@/hooks/useMember";
import { cn, formatDate, formatDayName, formatShortDate } from "@/lib/utils";
import { Loader2, Plus, Check, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Meal {
  id: number;
  date: string;
  day_name: string;
  main_course_menu: string;
  second_course_menu: string;
  dessert_menu: string;
  participant_count: number;
  requires_rice: boolean;
}

interface MealPlan {
  id: number;
  week_start: string;
  week_end: string;
  status: string;
  meals: Meal[];
}

export default function Dashboard() {
  const { member } = useMember();
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
    } catch (err) {
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
              <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Menu Pekanan</h1>
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
            <div className="flex-shrink-0 flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-1.5 rounded-lg">
              <span className="text-[10px] uppercase font-semibold tracking-wide">{plan.status}</span>
            </div>
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
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Lauk</span>
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {meal.main_course_menu || <span className="text-muted-foreground/50 italic">Belum ditentukan</span>}
                      </p>
                    </div>
                  </div>

                  {/* Sayur */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Sayur</span>
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {meal.second_course_menu || <span className="text-muted-foreground/50 italic">Belum ditentukan</span>}
                      </p>
                    </div>
                  </div>

                  {/* Dessert */}
                  {meal.dessert_menu && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">Dessert</span>
                        <p className="text-sm font-medium text-foreground leading-snug">{meal.dessert_menu}</p>
                      </div>
                    </div>
                  )}

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
                        : "border-border text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                    )}
                    disabled={isToggling}
                    onClick={() => toggleJoin(meal.id)}
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isJoined ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 stroke-[2.5px]" />
                        Ikut!
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
      </div>
    </PageContainer>
  );
}

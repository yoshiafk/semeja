import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMember } from "@/hooks/useMember";
import { cn, formatDate, formatDayName, formatShortDate } from "@/lib/utils";
import { Loader2, Plus, Check, CalendarDays, Utensils } from "lucide-react";
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
      // Update count locally for immediate feedback
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!plan) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <CalendarDays className="h-16 w-16 text-muted-foreground/20" />
          <div>
            <h2 className="text-xl font-bold">Belum ada menu pekan ini</h2>
            <p className="text-muted-foreground">Tunggu admin buat jadwalnya ya!</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 gap-6 border-b border-stone-100">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-stone-900 leading-none mb-2">Menu Pekanan</h1>
            <p className="text-stone-500 font-medium">
              {formatDate(plan.week_start)} — {formatDate(plan.week_end)}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
             {plans.length > 1 && (
               <Select value={selectedPlanId || ""} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="h-11 w-[220px] bg-stone-50 border-stone-100 rounded-full font-bold shadow-none text-xs">
                    <SelectValue placeholder="Pilih Pekan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-stone-200">
                    {plans.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()} className="font-medium">
                        {formatDate(p.week_start)} {p.id === plans[0].id ? '(Pekan Ini)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
               </Select>
             )}
             <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-6 py-2 uppercase font-black text-[10px] tracking-widest rounded-full">
               {plan.status.toUpperCase()}
             </Badge>
          </div>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {plan.meals.map((meal) => (
            <Card key={meal.id} className="overflow-hidden border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
              <CardHeader className="bg-stone-50/50 pb-3 group-hover:bg-primary/5 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-stone-900">{formatDayName(meal.date)}</CardTitle>
                  <CardDescription className="font-bold text-primary/60">
                    {formatShortDate(meal.date)}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                  <div className="space-y-4">
                    {/* Main Course */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-orange-400 tracking-widest">
                        <Utensils className="h-3 w-3" /> Menu Utama (Lauk)
                      </div>
                      <p className="font-bold text-stone-800 leading-tight">
                        {meal.main_course_menu || <span className="text-stone-300 italic font-normal">Tidak ada menu</span>}
                      </p>
                    </div>

                    {/* Second Course */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                        <Utensils className="h-3 w-3" /> Sayuran
                      </div>
                      <p className="font-bold text-stone-800 leading-tight">
                        {meal.second_course_menu || <span className="text-stone-300 italic font-normal">Tidak ada menu</span>}
                      </p>
                    </div>

                    {/* Dessert */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                        <Utensils className="h-3 w-3" /> Pencuci Mulut
                      </div>
                      <p className="font-bold text-stone-800 leading-tight">
                        {meal.dessert_menu || <span className="text-stone-300 italic font-normal">Tidak ada menu</span>}
                      </p>
                    </div>

                    {/* Rice Indicator */}
                    {Boolean(meal.requires_rice) === true && (
                      <div className="pt-3 border-t border-stone-100/50">
                        <Badge variant="outline" className="bg-stone-50 text-stone-500 border-stone-200 font-bold text-[10px] py-1 px-3 rounded-lg">
                          + Nasi Putih
                        </Badge>
                      </div>
                    )}
                  </div>

                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest leading-none mb-1">Partisipasi</span>
                    <span className="text-sm font-bold text-stone-900">
                      <span className="text-primary">{meal.participant_count}</span> orang
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={participations.includes(meal.id) ? "default" : "outline"}
                    className={cn(
                      "h-10 px-6 rounded-xl font-bold transition-all",
                      participations.includes(meal.id) 
                        ? "bg-primary hover:bg-primary/90 shadow-md shadow-primary/20" 
                        : "hover:bg-primary/5 hover:text-primary border-stone-200"
                    )}
                    disabled={togglingMeals.includes(meal.id)}
                    onClick={() => toggleJoin(meal.id)}
                  >
                    {togglingMeals.includes(meal.id) ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : participations.includes(meal.id) ? (
                      <Check className="mr-2 h-4 w-4 stroke-[3px]" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4 stroke-[3px]" />
                    )}
                    {participations.includes(meal.id) ? "Ikut!" : "Gabung"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

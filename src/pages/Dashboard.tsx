import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMember } from "@/hooks/useMember";
import { cn, formatDate } from "@/lib/utils";
import { Loader2, Plus, Check, CalendarDays, Utensils } from "lucide-react";

interface Meal {
  id: number;
  date: string;
  day_name: string;
  main_course_menu: string;
  second_course_menu: string;
  dessert_menu: string;
  participant_count: number;
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
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [participations, setParticipations] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [member]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const activePlan = await api.get<MealPlan>("/meal-plans/active");
      if (activePlan) {
        setPlan(activePlan);
        const userParts = await api.get<any[]>(`/participations/${activePlan.id}`);
        const mealIds = userParts
          .filter((p) => p.member_id === member?.id)
          .map((p) => p.meal_id);
        setParticipations(mealIds);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJoin = async (mealId: number) => {
    if (!member) return;
    const isJoined = participations.includes(mealId);
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
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Menu Pekanan</h1>
            <p className="text-stone-500 font-medium">
              {formatDate(plan.week_start)} — {formatDate(plan.week_end)}
            </p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 uppercase font-black text-[10px] tracking-widest">
            {plan.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {plan.meals.map((meal) => (
            <Card key={meal.id} className="overflow-hidden border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
              <CardHeader className="bg-stone-50/50 pb-3 group-hover:bg-primary/5 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-stone-900">{meal.day_name}</CardTitle>
                  <CardDescription className="font-bold text-primary/60">
                    {new Date(meal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
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
                    onClick={() => toggleJoin(meal.id)}
                  >
                    {participations.includes(meal.id) ? (
                      <><Check className="mr-2 h-4 w-4 stroke-[3px]" /> Ikut!</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4 stroke-[3px]" /> Gabung</>
                    )}
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

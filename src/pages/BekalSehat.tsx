import { useEffect, useState, useCallback } from "react";
import { useMember } from "@/hooks/useMember";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  getBekalPlans,
  getBekalPlanDetail,
  getBekalBumbuDasar,
  joinBekalPlan,
  leaveBekalPlan,
  type BekalPlan,
  type BekalPlanDetail,
  type BekalBumbuDasar,
  type BekalRecipe,
} from "@/lib/api";
import { toast } from "sonner";
import {
  Salad,
  ChefHat,
  Clock,
  Flame,
  Lightbulb,
  Users,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Drumstick,
  Leaf,
  Sparkles,
  PackageOpen,
  UserPlus,
  UserMinus,
  Check,
  BarChart3,
  CalendarDays,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ── Bumbu Color Palette ────────────────────────────────────────────────
const BUMBU_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; icon: string; dot: string }> = {
  merah: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    icon: "text-rose-500",
    dot: "bg-rose-400",
  },
  putih: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-700",
    icon: "text-slate-400",
    dot: "bg-slate-400",
  },
  kuning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    icon: "text-amber-500",
    dot: "bg-amber-400",
  },
};

const DAY_COLORS = [
  "from-teal-500 to-emerald-500",
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-pink-500 to-rose-500",
  "from-amber-500 to-orange-500",
  "from-lime-500 to-green-500",
  "from-indigo-500 to-blue-500",
];

// ── Helper: Scale ingredient quantity ──────────────────────────────────
function formatQty(qty: number, portions: number, isBumbu: boolean = false, unit: string = "", name: string = ""): string {
  let multiplier = portions;
  
  const nameLower = name.toLowerCase();
  const isSeasoning = 
    isBumbu || 
    unit.toLowerCase() === "sdt" || 
    unit.toLowerCase() === "sdm" || 
    nameLower.includes("garam") || 
    nameLower.includes("gula") || 
    nameLower.includes("kecap") || 
    nameLower.includes("saus") || 
    nameLower.includes("kaldu") ||
    nameLower.includes("minyak") ||
    nameLower.includes("merica") ||
    nameLower.includes("ketumbar") ||
    nameLower.includes("daun") || // daun salam, daun jeruk
    nameLower.includes("serai") ||
    nameLower.includes("sereh") ||
    nameLower.includes("lengkuas") ||
    nameLower.includes("jahe");

  // Non-linear scaling for spices/seasonings (Power curve ^0.65 for accurate culinary scaling)
  // 1 -> 1x, 2 -> ~1.5x, 3 -> ~2x, 4 -> ~2.4x, 5 -> ~2.8x
  if (isSeasoning) {
    multiplier = Math.pow(portions, 0.65);
  }

  const scaled = qty * multiplier;
  
  // Format beautifully: if it's an integer, return it. If it's close to .0, remove decimal.
  // We use toFixed(1) but strip trailing zeros
  const formatted = parseFloat(scaled.toFixed(1));
  return String(formatted);
}

// ── Helper: Format day date ──────────────────────────────────────────
function formatDayDate(startDateStr: string, dayNumber: number): string {
  if (!startDateStr) return `Hari ${dayNumber}`;
  const date = new Date(startDateStr);
  date.setDate(date.getDate() + (dayNumber - 1));
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// ── RecipeCard Component ──────────────────────────────────────────────
function RecipeDetailCard({
  recipe,
  portions,
}: {
  recipe: BekalRecipe;
  portions: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isProtein = recipe.category === "protein";
  const bumbuStyle = recipe.bumbu_dasar_color ? BUMBU_STYLES[recipe.bumbu_dasar_color] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card overflow-hidden transition-all duration-300",
        expanded ? "shadow-lg border-primary/20" : "shadow-sm border-border/50 hover:border-border hover:shadow-md"
      )}
    >
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3 touch-active"
      >
        {/* Icon */}
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
            isProtein ? "bg-orange-100" : "bg-emerald-100"
          )}
        >
          {isProtein ? (
            <Drumstick className="w-5 h-5 text-orange-600" />
          ) : (
            <Leaf className="w-5 h-5 text-emerald-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                isProtein ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
              )}
            >
              {isProtein ? "Protein" : "Sayuran"}
            </span>
            {bumbuStyle && (
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", bumbuStyle.badge)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", bumbuStyle.dot)} />
                {recipe.bumbu_dasar_name?.replace("Bumbu Dasar ", "")}
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-foreground leading-snug">{recipe.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{recipe.description}</p>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {recipe.estimasi_waktu} min
            </span>
            {recipe.kalori_estimasi > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Flame className="w-3 h-3" />
                {recipe.kalori_estimasi * portions} kcal
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <PackageOpen className="w-3 h-3" />
              {recipe.ingredients?.length || 0} bahan
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 pt-1">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable Detail */}
      {expanded && (
        <div className="border-t border-border/30 animate-page-in">
          {/* Ingredients */}
          <div className="p-4">
            <h5 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <Salad className="w-3.5 h-3.5 text-primary" />
              Bahan ({portions} porsi)
            </h5>
            <div className="grid gap-1.5">
              {recipe.ingredients?.map((ing) => (
                <div
                  key={ing.id}
                  className={cn(
                    "flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs",
                    ing.is_bumbu_dasar ? (bumbuStyle?.bg || "bg-muted/50") : "bg-muted/30"
                  )}
                >
                  <span className={cn("font-medium", ing.is_bumbu_dasar ? (bumbuStyle?.text || "") : "text-foreground")}>
                    {ing.name}
                    {ing.is_bumbu_dasar && (
                      <span className="ml-1 text-[9px] font-bold opacity-60">✦ BUMBU</span>
                    )}
                  </span>
                  <span className="text-muted-foreground font-mono tabular-nums">
                    {formatQty(Number(ing.quantity_per_portion), portions, ing.is_bumbu_dasar, ing.unit, ing.name)} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div className="p-4 pt-0">
            <h5 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5 text-primary" />
              Cara Memasak
            </h5>
            <div className="space-y-2.5">
              {recipe.steps?.map((step) => (
                <div key={step.id} className="flex gap-2.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                    {step.step_number}
                  </span>
                  <p className="text-xs text-foreground/80 leading-relaxed pt-0.5">
                    {step.instruction}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          {recipe.tips_bekal && (
            <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-bold">Tips Bekal:</span> {recipe.tips_bekal}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── BumbuDasarCard Component ──────────────────────────────────────────
function BumbuDasarCard({
  bumbu,
  portions,
  usedOnDays,
}: {
  bumbu: BekalBumbuDasar;
  portions: number;
  usedOnDays: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const style = BUMBU_STYLES[bumbu.color] || BUMBU_STYLES.putih;

  return (
    <div className={cn("rounded-2xl border overflow-hidden transition-all duration-300", style.bg, style.border, expanded && "shadow-md")}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3.5 touch-active">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", `bg-white/60`)}>
            <ChefHat className={cn("w-5 h-5", style.icon)} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={cn("text-sm font-bold", style.text)}>{bumbu.name}</h4>
            <div className="flex flex-wrap gap-1 mt-1">
              {usedOnDays.map((d) => (
                <span key={d} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/70 text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 animate-page-in">
          <div className="rounded-xl bg-white/60 p-3 mb-3">
            <p className="text-[11px] text-muted-foreground mb-2.5">{bumbu.description}</p>
            <div className="space-y-1">
              {bumbu.ingredients?.map((ing) => (
                <div key={ing.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80">{ing.name}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {formatQty(Number(ing.quantity_per_portion), portions, true, ing.unit, ing.name)} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/60 p-3 mb-2">
            <h5 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1">
              <ChefHat className="w-3 h-3" /> Cara Membuat
            </h5>
            <p className="text-[11px] text-foreground/70 leading-relaxed">{bumbu.cara_membuat}</p>
          </div>

          <div className="rounded-xl bg-white/60 p-3">
            <h5 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Penyimpanan
            </h5>
            <p className="text-[11px] text-foreground/70 leading-relaxed">{bumbu.tips_penyimpanan}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PortionSelector Component ─────────────────────────────────────────
function PortionSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1 || disabled}
        className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 transition-all touch-active"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="w-16 text-center">
        <span className="text-2xl font-extrabold text-foreground tabular-nums">{value}</span>
        <p className="text-[10px] text-muted-foreground -mt-0.5">porsi</p>
      </div>
      <button
        onClick={() => onChange(Math.min(10, value + 1))}
        disabled={value >= 10 || disabled}
        className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 transition-all touch-active"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Helper: Get today's day index (0-6, Mon=0) ──────────────────────
function getTodayDayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ...
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to Mon=0, Sun=6
}

// ── Helper: days until a date ────────────────────────────────────────
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Main Page Component ───────────────────────────────────────────────
export default function BekalSehat() {
  const { member, isAdmin } = useMember();
  const [plans, setPlans] = useState<BekalPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BekalPlanDetail | null>(null);
  const [bumbuDasar, setBumbuDasar] = useState<BekalBumbuDasar[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [portions, setPortions] = useState(1);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming'>('active');

  // Derived plan references
  const activePlan = plans.find((p) => p.status === 'active');
  const upcomingPlan = plans.find((p) => p.status === 'upcoming');
  const hasMultiplePlans = !!activePlan && !!upcomingPlan;

  // Check if current member is a participant
  const myParticipation = selectedPlan?.participants?.find(
    (p) => p.member_id === member?.id
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, bumbuData] = await Promise.all([
        getBekalPlans('member'),
        getBekalBumbuDasar(),
      ]);
      setPlans(plansData);
      setBumbuDasar(bumbuData);

      // Auto-load the active plan (or first available)
      const active = plansData.find((p) => p.status === 'active') || plansData[0];
      if (active) {
        const detail = await getBekalPlanDetail(active.id);
        setSelectedPlan(detail);
        setActiveTab('active');

        // Auto-select today's day for active plan
        const todayIdx = getTodayDayIndex();
        if (detail.days && todayIdx < detail.days.length) {
          setSelectedDay(todayIdx);
        }

        // If member is already joined, set their portions
        const myPart = detail.participants?.find((p) => p.member_id === member?.id);
        if (myPart) setPortions(myPart.portions);
      }
    } catch (err) {
      console.error("Failed to load bekal sehat data:", err);
      toast.error("Gagal memuat data Bekal Sehat");
    } finally {
      setLoading(false);
    }
  }, [member?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Join/Leave handlers
  const handleJoin = async () => {
    if (!selectedPlan || !member) return;
    setJoining(true);
    try {
      await joinBekalPlan(selectedPlan.id, { member_id: member.id, portions });
      toast.success(`Berhasil gabung untuk ${portions} porsi!`);
      // Reload plan detail
      const detail = await getBekalPlanDetail(selectedPlan.id);
      setSelectedPlan(detail);
    } catch {
      toast.error("Gagal gabung ke plan");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedPlan || !member) return;
    setJoining(true);
    try {
      await leaveBekalPlan(selectedPlan.id, { member_id: member.id });
      toast.success("Berhasil keluar dari plan");
      setPortions(1);
      const detail = await getBekalPlanDetail(selectedPlan.id);
      setSelectedPlan(detail);
    } catch {
      toast.error("Gagal keluar dari plan");
    } finally {
      setJoining(false);
    }
  };

  const handleUpdatePortions = async (newPortions: number) => {
    setPortions(newPortions);
    // If already joined, auto-update
    if (myParticipation && selectedPlan && member) {
      try {
        await joinBekalPlan(selectedPlan.id, { member_id: member.id, portions: newPortions });
        const detail = await getBekalPlanDetail(selectedPlan.id);
        setSelectedPlan(detail);
      } catch {
        // silently fail, portions already updated locally
      }
    }
  };

  // Derive which days use each bumbu
  const bumbuDayMap: Record<number, string[]> = {};
  selectedPlan?.days?.forEach((day) => {
    day.recipes?.forEach((recipe) => {
      if (recipe.bumbu_dasar_id) {
        if (!bumbuDayMap[recipe.bumbu_dasar_id]) bumbuDayMap[recipe.bumbu_dasar_id] = [];
        if (!bumbuDayMap[recipe.bumbu_dasar_id].includes(day.day_name)) {
          bumbuDayMap[recipe.bumbu_dasar_id].push(day.day_name);
        }
      }
    });
  });

  const currentDay = selectedPlan?.days?.[selectedDay];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  if (!selectedPlan || plans.length === 0) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center mb-4">
            <Salad className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Belum Ada Menu Bekal</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isAdmin
              ? "Sebagai admin, kamu bisa membuat menu bekal sehat mingguan untuk anggota kost."
              : "Tunggu admin membuat menu bekal sehat mingguan. Nanti kamu bisa join dan sesuaikan porsimu."}
          </p>
        </div>
      </PageContainer>
    );
  }

  // Handle tab switch between active and upcoming plans
  const handleTabSwitch = async (tab: 'active' | 'upcoming') => {
    const targetPlan = tab === 'active' ? activePlan : upcomingPlan;
    if (!targetPlan) return;

    setActiveTab(tab);
    setLoading(true);
    try {
      const detail = await getBekalPlanDetail(targetPlan.id);
      setSelectedPlan(detail);

      // Auto-select today for active, day 1 for upcoming
      if (tab === 'active') {
        const todayIdx = getTodayDayIndex();
        setSelectedDay(detail.days && todayIdx < detail.days.length ? todayIdx : 0);
      } else {
        setSelectedDay(0);
      }

      // Set portions from participation
      const myPart = detail.participants?.find((p) => p.member_id === member?.id);
      setPortions(myPart ? myPart.portions : 1);
    } catch {
      toast.error("Gagal memuat data plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="animate-page-in">
        {/* ── Plan Tab Switcher ──────────────────────────────────── */}
        {hasMultiplePlans && (
          <div className="mb-5 flex gap-2 p-1 bg-muted/50 rounded-2xl">
            <button
              onClick={() => handleTabSwitch('active')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200",
                activeTab === 'active'
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Minggu Ini
            </button>
            <button
              onClick={() => handleTabSwitch('upcoming')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 relative",
                activeTab === 'upcoming'
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Minggu Depan
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            </button>
          </div>
        )}

        {/* ── Upcoming Plan Banner ───────────────────────────────── */}
        {selectedPlan?.status === 'upcoming' && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <div className="flex items-start gap-2.5">
              <CalendarClock className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-800">
                  Menu Minggu Depan — mulai {selectedPlan.start_date ? new Date(selectedPlan.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : ''}
                  {selectedPlan.start_date && ` (${daysUntil(selectedPlan.start_date)} hari lagi)`}
                </p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  Gabung sekarang agar bahan bisa disiapkan!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Hero Section ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
              selectedPlan?.status === 'upcoming' ? "from-blue-400 to-indigo-500" : "from-emerald-400 to-teal-500"
            )}>
              <Salad className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground leading-tight">Bekal Sehat</h1>
              <p className="text-xs text-muted-foreground">{selectedPlan?.week_label}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {selectedPlan?.description}
          </p>
        </div>

        {/* ── Participant Info + Join/Leave ────────────────────────── */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-emerald-50 border border-primary/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {selectedPlan.participants?.length || 0} orang ikut
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {myParticipation ? `Kamu sudah ikut (${myParticipation.portions} porsi)` : "Kamu belum ikut"}
                </p>
              </div>
            </div>
            {myParticipation ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                onClick={handleLeave}
                disabled={joining}
              >
                {joining ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserMinus className="w-3 h-3 mr-1" />}
                Keluar
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
                Gabung
              </Button>
            )}
          </div>

          {/* Portion Selector */}
          <div className="flex items-center justify-between bg-white/60 rounded-xl p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Jumlah Porsi</p>
              <p className="text-[10px] text-muted-foreground">Sesuaikan bahan per porsimu</p>
            </div>
            <PortionSelector value={portions} onChange={handleUpdatePortions} disabled={joining} />
          </div>

          {/* Participants list */}
          {selectedPlan.participants && selectedPlan.participants.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedPlan.participants.map((p) => (
                <span
                  key={p.id}
                  className={cn(
                    "text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1",
                    p.member_id === member?.id
                      ? "bg-primary/15 text-primary"
                      : "bg-white/60 text-muted-foreground"
                  )}
                >
                  {p.member_id === member?.id && <Check className="w-2.5 h-2.5" />}
                  {p.member_name} ({p.portions}p)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Day Selector ────────────────────────────────────────── */}
        <div className="mb-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Menu 7 Hari
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {selectedPlan.days?.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setSelectedDay(idx)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-1 px-3.5 py-2.5 rounded-xl transition-all duration-200 touch-active min-w-[70px]",
                  selectedDay === idx
                    ? "bg-gradient-to-b text-white shadow-lg scale-105 " + DAY_COLORS[idx]
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {formatDayDate(selectedPlan.start_date, day.day_number)}
                </span>
                <span className={cn("text-sm font-extrabold", selectedDay === idx ? "text-white" : "text-foreground")}>
                  {day.day_name?.slice(0, 3)}
                </span>
                {/* Bumbu indicators */}
                <div className="flex gap-0.5 mt-0.5">
                  {day.recipes?.map((r) => (
                    r.bumbu_dasar_color && (
                      <span
                        key={r.id}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          selectedDay === idx ? "bg-white/60" : BUMBU_STYLES[r.bumbu_dasar_color]?.dot
                        )}
                      />
                    )
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Daily Menu ──────────────────────────────────────────── */}
        {currentDay && (
          <div className="mb-8 space-y-3 stagger-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-foreground">
                {currentDay.day_name}, {formatDayDate(selectedPlan.start_date, currentDay.day_number)}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {currentDay.recipes?.length || 0} resep
              </span>
            </div>
            {currentDay.recipes?.map((recipe: BekalRecipe) => (
              <RecipeDetailCard key={recipe.id} recipe={recipe} portions={portions} />
            ))}
          </div>
        )}

        {/* ── Bumbu Dasar Section ─────────────────────────────────── */}
        {bumbuDasar.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-primary" />
              Bumbu Dasar — Persiapan Mingguan
            </h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Siapkan 3 bumbu dasar ini di awal minggu. Satu kali prep, pakai sepanjang minggu! 
              Takaran di bawah sudah disesuaikan untuk <strong>{portions} porsi</strong>.
            </p>
            <div className="space-y-3">
              {bumbuDasar.map((bumbu) => (
                <BumbuDasarCard
                  key={bumbu.id}
                  bumbu={bumbu}
                  portions={portions}
                  usedOnDays={bumbuDayMap[bumbu.id] || []}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Weekly Summary ──────────────────────────────────────── */}
        {selectedPlan.days && selectedPlan.days.length > 0 && (
          <Card className="mb-8 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Ringkasan Mingguan ({portions} porsi)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-border/50 bg-muted/10">
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background border shadow-sm">
                  <p className="text-xl font-extrabold text-primary">
                    {selectedPlan.days.reduce((acc, d) => acc + (d.recipes?.length || 0), 0)}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Total Resep</p>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background border shadow-sm">
                  <p className="text-xl font-extrabold text-emerald-600">
                    {selectedPlan.days.reduce(
                      (acc, d) =>
                        acc + (d.recipes?.reduce((a, r) => a + (r.kalori_estimasi || 0), 0) || 0),
                      0
                    ) * portions}
                  </p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Total kcal</p>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-background border shadow-sm">
                  <p className="text-xl font-extrabold text-amber-600">{bumbuDasar.length}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Bumbu Dasar</p>
                </div>
              </div>

              {/* Per-day mini overview */}
              <div className="p-4 space-y-3">
                {selectedPlan.days.map((day) => (
                  <div key={day.id} className="flex items-start sm:items-center gap-3 text-xs">
                    <span className="font-bold text-muted-foreground w-12 pt-1 sm:pt-0">{day.day_name?.slice(0, 3)}</span>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {day.recipes?.map((r) => (
                        <span
                          key={r.id}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-semibold border",
                            r.category === "protein" 
                              ? "bg-orange-50 text-orange-700 border-orange-200" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}
                        >
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

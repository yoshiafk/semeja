import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChefHat, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipe {
  id: number;
  name: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  main_course_menu: string;
  main_course_recipe_id: number | null;
  second_course_menu: string;
  second_course_recipe_id: number | null;
  dessert_menu: string;
  dessert_recipe_id: number | null;
  requires_rice: boolean;
}

interface MealCardProps {
  meal: Meal;
  dayName: string;
  formattedDateStr: string;
  recipes: Recipe[];
  isSaving: Record<string, boolean>;
  onUpdateMeal: (mealId: number, updates: Partial<Meal>) => void;
}

export const MealCard = React.memo(({
  meal,
  dayName,
  formattedDateStr,
  recipes,
  isSaving,
  onUpdateMeal
}: MealCardProps) => {
  const handleSelectChange = (type: 'main' | 'second' | 'dessert', value: string) => {
    const rid = value === "placeholder" ? null : parseInt(value);
    const updates: Partial<Meal> = {};
    const key = type === 'main' ? 'main_course_recipe_id' : type === 'second' ? 'second_course_recipe_id' : 'dessert_recipe_id';
    const menuKey = type === 'main' ? 'main_course_menu' : type === 'second' ? 'second_course_menu' : 'dessert_menu';
    
    updates[key] = rid;
    if (rid) {
      const r = recipes.find(rec => rec.id === rid);
      if (r) updates[menuKey] = r.name;
    } else {
      updates[menuKey] = "";
    }
    
    onUpdateMeal(meal.id, updates);
  };

  return (
    <div className="bg-white border border-border/50 rounded-2xl overflow-hidden hover:shadow-md hover:shadow-border/50 transition-shadow">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <div>
          <h3 className="text-base font-semibold text-foreground">{dayName}</h3>
          <span className="text-xs text-primary/70 font-medium">{formattedDateStr}</span>
        </div>
        <Calendar className="h-4 w-4 text-border" />
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-5">
        {/* Main Course */}
        <CourseSelector 
          label="Lauk"
          color="bg-orange-400"
          value={meal.main_course_recipe_id}
          isSaving={isSaving[`${meal.id}-main_course_recipe_id`]}
          recipes={recipes.filter(r => r.category === 'Lauk' || !r.category)}
          onChange={(v: string) => handleSelectChange('main', v)}
        />

        {/* Second Course */}
        <CourseSelector 
          label="Sayur"
          color="bg-emerald-400"
          value={meal.second_course_recipe_id}
          isSaving={isSaving[`${meal.id}-second_course_recipe_id`]}
          recipes={recipes.filter(r => r.category === 'Sayur')}
          onChange={(v: string) => handleSelectChange('second', v)}
        />

        {/* Dessert */}
        <CourseSelector 
          label="Dessert"
          color="bg-violet-400"
          value={meal.dessert_recipe_id}
          isSaving={isSaving[`${meal.id}-dessert_recipe_id`]}
          recipes={recipes.filter(r => r.category === 'Dessert')}
          onChange={(v: string) => handleSelectChange('dessert', v)}
        />

        {/* Rice Toggle */}
        <div className="pt-4 border-t border-border/30 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/70 font-medium block">Nasi Putih</span>
          <button
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-medium transition-all",
              meal.requires_rice 
                ? "bg-primary text-white" 
                : "border border-border text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
            disabled={isSaving[`${meal.id}-requires_rice`]}
            onClick={() => onUpdateMeal(meal.id, { requires_rice: !meal.requires_rice })}
          >
            {isSaving[`${meal.id}-requires_rice`] ? (
              <Loader2 className="h-3 w-3 animate-spin mx-auto" />
            ) : (
              meal.requires_rice ? "Ya" : "Tidak"
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

const CourseSelector = ({ label, color, value, isSaving, recipes, onChange }: any) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
      <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">{label}</span>
    </div>
    <Select disabled={isSaving} value={value?.toString() || "placeholder"} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full bg-secondary/80 border-border/50 rounded-xl text-sm font-medium hover:bg-secondary transition-colors">
        <div className="flex items-center gap-2 truncate">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70 shrink-0" /> : <ChefHat className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />}
          <SelectValue placeholder="Pilih Menu..." />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50">
        <SelectItem value="placeholder" className="text-muted-foreground/70 italic">Pilih Menu...</SelectItem>
        {recipes.map((r: any) => <SelectItem key={r.id} value={r.id.toString()} className="font-medium">{r.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);

MealCard.displayName = "MealCard";

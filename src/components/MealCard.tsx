import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChefHat, Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recipe {
  id: number;
  name: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
}

interface MealMenuItem {
  id: number;
  recipe_id: number | null;
  custom_name: string;
  category: 'main' | 'second' | 'dessert';
  sort_order: number;
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
  items: MealMenuItem[];
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
  const items = meal.items || [];

  const handleAddItem = (type: 'main' | 'second' | 'dessert', recipeId: number) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const newItem: MealMenuItem = {
      id: Math.random(), // Temporary ID for UI
      recipe_id: recipe.id,
      custom_name: recipe.name,
      category: type,
      sort_order: items.length
    };

    const updatedItems = [...items, newItem];
    onUpdateMeal(meal.id, { items: updatedItems });
  };

  const handleRemoveItem = (itemId: number) => {
    const updatedItems = items.filter(it => it.id !== itemId);
    onUpdateMeal(meal.id, { items: updatedItems });
  };

  const getCategoryItems = (type: 'main' | 'second' | 'dessert') => 
    items.filter(it => it.category === type);

  return (
    <div className="bg-white border border-border/50 rounded-2xl overflow-hidden hover:shadow-md hover:shadow-border/50 transition-shadow">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <div>
          <h3 className="text-base font-semibold text-foreground">{dayName}</h3>
          <span className="text-xs text-primary/70 font-medium">{formattedDateStr}</span>
        </div>
        <Calendar className="size-4 text-border" />
      </div>

      {/* Card Body */}
      <div className="p-5 flex flex-col gap-5">
        <CourseSelector 
          label="Lauk"
          color="bg-orange-400"
          items={getCategoryItems('main')}
          recipes={recipes.filter(r => r.category === 'Lauk' || !r.category)}
          onAdd={(rid: number) => handleAddItem('main', rid)}
          onRemove={handleRemoveItem}
          isSaving={isSaving[`${meal.id}-items`]}
        />

        <CourseSelector 
          label="Sayur"
          color="bg-emerald-400"
          items={getCategoryItems('second')}
          recipes={recipes.filter(r => r.category === 'Sayur')}
          onAdd={(rid: number) => handleAddItem('second', rid)}
          onRemove={handleRemoveItem}
          isSaving={isSaving[`${meal.id}-items`]}
        />

        <CourseSelector 
          label="Dessert"
          color="bg-violet-400"
          items={getCategoryItems('dessert')}
          recipes={recipes.filter(r => r.category === 'Dessert')}
          onAdd={(rid: number) => handleAddItem('dessert', rid)}
          onRemove={handleRemoveItem}
          isSaving={isSaving[`${meal.id}-items`]}
        />

        {/* Rice Toggle */}
        <div className="pt-4 border-t border-border/30 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/70 font-medium block">Nasi Putih</span>
          <button
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-medium transition-all",
              meal.requires_rice 
                ? "bg-primary text-white font-semibold" 
                : "border border-border text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
            disabled={isSaving[`${meal.id}-requires_rice`]}
            onClick={() => onUpdateMeal(meal.id, { requires_rice: !meal.requires_rice })}
          >
            {isSaving[`${meal.id}-requires_rice`] ? (
              <Loader2 className="size-3 animate-spin mx-auto" />
            ) : (
              meal.requires_rice ? "Ya" : "Tidak"
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

const CourseSelector = ({ label, color, items, recipes, onAdd, onRemove, isSaving }: any) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{label}</span>
      {isSaving && <Loader2 className="h-2.5 w-2.5 animate-spin ml-auto text-muted-foreground/40" />}
    </div>
    
    {/* Selected Items Chips */}
    <div className="flex flex-wrap gap-1.5 min-h-[24px]">
      {items.map((item: any) => (
        <div 
          key={item.id} 
          className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 border border-border/30 rounded-lg group animate-in fade-in zoom-in duration-200"
        >
          <span className="text-xs font-medium text-foreground/80">{item.custom_name}</span>
          <button 
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-muted-foreground/50 hover:text-rose-500 transition-colors"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <span className="text-[11px] text-muted-foreground/40 italic py-1">Belum dipilih</span>
      )}
    </div>

    {/* Add Item Trigger */}
    <Select value="placeholder" onValueChange={(v) => v !== "placeholder" && onAdd(parseInt(v))}>
      <SelectTrigger className="h-8 w-full bg-secondary/30 border-dashed border-border/50 rounded-lg text-[11px] font-medium hover:bg-secondary/50 hover:border-border transition-all">
        <div className="flex items-center gap-2">
          <ChefHat className="size-3 text-muted-foreground/50" />
          <SelectValue placeholder={`Tambah ${label}...`} />
        </div>
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/50 shadow-xl">
        <SelectItem value="placeholder" className="text-muted-foreground/50 italic text-xs">Pilih {label}...</SelectItem>
        {recipes.map((r: any) => (
          <SelectItem key={r.id} value={r.id.toString()} className="text-xs font-medium">
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

MealCard.displayName = "MealCard";

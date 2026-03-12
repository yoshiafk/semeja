import React from "react";
import { Button } from "@/components/ui/button";
import { Link2, Edit2, Trash2, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Ingredient {
  id: number;
  name: string;
  quantity_per_person: number;
  unit: string;
  ingredient_id?: number;
}

interface Recipe {
  id: number;
  name: string;
  description: string;
  category: 'Lauk' | 'Sayur' | 'Dessert';
  source_url: string;
  servings: number;
  is_normalized: boolean;
  ingredients: Ingredient[];
}

interface RecipeCardProps {
  recipe: Recipe;
  isRescraping: boolean;
  isDeleting: boolean;
  onRescrape: (recipe: Recipe) => void;
  onNormalize: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: number) => void;
}

export const RecipeCard = React.memo(({ 
  recipe, 
  isRescraping, 
  isDeleting, 
  onRescrape, 
  onNormalize, 
  onEdit, 
  onDelete 
}: RecipeCardProps) => {
  return (
    <div className="rounded-2xl border border-border/50 bg-white hover:border-border transition-all p-4 group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{recipe.name}</h3>
            {recipe.is_normalized ? (
              <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full" title="Resep sudah dinormalisasi per 1 porsi">
                <CheckCircle2 className="h-3 w-3 mr-0.5" /> 1 porsi
              </span>
            ) : (
              <span className="flex items-center text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full" title="Resep belum dinormalisasi - jumlah bahan mungkin untuk beberapa porsi">
                <AlertTriangle className="h-3 w-3 mr-0.5" /> Belum normal
              </span>
            )}
          </div>
          {recipe.source_url ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1">
              <Link2 className="h-3 w-3" /> Cookpad {recipe.servings > 1 && `(${recipe.servings} porsi asli)`}
            </a>
          ) : (
            <p className="text-[11px] text-muted-foreground/70">Manual Entry</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {recipe.source_url && (
            <Button 
              variant="ghost" size="icon" 
              disabled={isRescraping}
              className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-primary hover:bg-primary/10" 
              onClick={() => onRescrape(recipe)}
              title="Re-scrape dari Cookpad"
            >
              {isRescraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          )}
          {!recipe.is_normalized && !recipe.source_url && (
            <Button 
              variant="ghost" size="icon" 
              className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-amber-600 hover:bg-amber-50" 
              onClick={() => onNormalize(recipe)}
              title="Normalisasi manual"
            >
              <AlertTriangle className="h-3 w-3" />
            </Button>
          )}
          <Button 
            variant="ghost" size="icon" 
            className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-amber-600 hover:bg-amber-50" 
            onClick={() => onEdit(recipe)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" size="icon" 
            disabled={isDeleting}
            className="h-7 w-7 rounded-lg text-muted-foreground/70 hover:text-red-500 hover:bg-red-50" 
            onClick={() => onDelete(recipe.id)}
          >
            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>
      
      <div className="pt-3 border-t border-border/30">
        <p className="text-[11px] text-muted-foreground/70 mb-1.5">{recipe.ingredients?.length || 0} bahan</p>
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients?.slice(0, 5).map(ing => (
            <span key={ing.id} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-md text-muted-foreground">
              {ing.name} ({ing.quantity_per_person} {ing.unit})
            </span>
          ))}
          {(recipe.ingredients?.length || 0) > 5 && (
            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-md text-muted-foreground/70">
              +{recipe.ingredients.length - 5} lagi
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

RecipeCard.displayName = "RecipeCard";

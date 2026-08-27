import { useState } from "react";
import { Plus, Trash2, UserCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TripDetail, TripPackingItem } from "@/types/trip";

interface TripPackingTabProps {
  trip: TripDetail;
  isAdmin?: boolean;
  onAddItem: (data: { category: string; item_name: string; assignee_id: number | null }) => Promise<void>;
  onToggleItem: (itemId: number, is_checked: boolean) => Promise<void>;
  onAssignItem: (itemId: number, assignee_id: number | null) => Promise<void>;
  onDeleteItem: (itemId: number) => Promise<void>;
}

export function TripPackingTab({
  trip,
  isAdmin,
  onAddItem,
  onToggleItem,
  onAssignItem,
  onDeleteItem,
}: TripPackingTabProps) {
  const [newItemName, setNewItemName] = useState("");
  const [activeCategory, setActiveCategory] = useState<"Bersama" | "Pribadi">("Bersama");

  const bersamaItems = (trip.packing || []).filter(item => item.category === "Bersama");
  const pribadiItems = (trip.packing || []).filter(item => item.category === "Pribadi");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    await onAddItem({
      category: activeCategory,
      item_name: newItemName.trim(),
      assignee_id: null,
    });
    setNewItemName("");
  };

  const renderItemList = (items: TripPackingItem[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-6 px-4 bg-muted/20 border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
        <ul className="divide-y divide-border/60">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
            >
              <Checkbox
                id={`pack-${item.id}`}
                checked={item.is_checked}
                onCheckedChange={(checked) => onToggleItem(item.id, !!checked)}
                className="w-5 h-5 rounded-md"
              />
              <div className="flex-1 min-w-0">
                <label
                  htmlFor={`pack-${item.id}`}
                  className={`text-sm font-medium leading-snug cursor-pointer transition-colors ${
                    item.is_checked ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {item.item_name}
                </label>
              </div>

              {/* Assignee Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-xs flex items-center gap-1.5 rounded-lg ${
                      item.assignee_id ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <UserCircle2 className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[80px]">
                      {item.assignee_name || "Tugaskan"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  {item.assignee_id && (
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 cursor-pointer"
                      onClick={() => onAssignItem(item.id, null)}
                    >
                      Hapus penugasan
                    </DropdownMenuItem>
                  )}
                  {trip.participants.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => onAssignItem(item.id, p.id)}
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                  {trip.participants.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                      Belum ada peserta trip
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={() => onDeleteItem(item.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const getProgress = (items: TripPackingItem[]) => {
    if (items.length === 0) return 0;
    const checked = items.filter(i => i.is_checked).length;
    return Math.round((checked / items.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Add Item Form */}
      <div className="bg-muted/30 p-4 rounded-2xl border border-border/50">
        <form onSubmit={handleAdd} className="flex gap-2">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value as any)}
            className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 flex-shrink-0"
          >
            <option value="Bersama">Bersama</option>
            <option value="Pribadi">Pribadi</option>
          </select>
          <input
            type="text"
            placeholder="Tambah barang bawaan..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="h-10 flex-1 min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" disabled={!newItemName.trim()}>
            <Plus className="w-5 h-5" />
          </Button>
        </form>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-foreground">Barang Bersama</h3>
            {bersamaItems.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {getProgress(bersamaItems)}% siap
              </span>
            )}
          </div>
          {renderItemList(bersamaItems, "Belum ada barang bawaan bersama. Cocok untuk kamera, P3K, atau tenda!")}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-foreground">Barang Pribadi</h3>
            {pribadiItems.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {getProgress(pribadiItems)}% siap
              </span>
            )}
          </div>
          {renderItemList(pribadiItems, "Belum ada barang bawaan pribadi. Cocok untuk baju ganti, sikat gigi, dll.")}
        </section>
      </div>
    </div>
  );
}

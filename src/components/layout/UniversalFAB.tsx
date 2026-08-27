import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, UtensilsCrossed, Wallet, Activity, Gift } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMember } from "@/hooks/useMember";
import { triggerHaptic } from "@/lib/haptics";

export function UniversalFAB() {
  const { isAdmin } = useMember();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) triggerHaptic("medium");
  };

  return (
    <div className="fixed z-[110] bottom-20 right-4 md:bottom-8 md:right-8">
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            aria-label="Menu aksi cepat"
            className={`size-14 rounded-full shadow-lg shadow-primary/30 transition-transform duration-300 ${open ? 'rotate-45' : ''}`}
          >
            <Plus className="size-6 stroke-[2.5px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-56 rounded-2xl p-2 border-border/50 shadow-xl shadow-black/5"
        >
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            Aksi Cepat
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/30" />
          
          {isAdmin && (
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 focus:bg-primary/10 group">
              <Link to="/meals/plan" className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Susun Jadwal</span>
                  <span className="text-xs text-muted-foreground">Buka puasa bersama</span>
                </div>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 focus:bg-primary/10 group">
            <Link to="/finance/costs" className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <Wallet className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Pusat Keuangan</span>
                <span className="text-xs text-muted-foreground">Atur tagihan & biaya</span>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 focus:bg-primary/10 group">
            <Link to="/activities/new" className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Activity className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Buat Aktivitas</span>
                <span className="text-xs text-muted-foreground">Acara atau kumpul bersama</span>
              </div>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 focus:bg-primary/10 group">
            <Link to="/community/gifts" className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Gift className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm">Kirim Kado</span>
                <span className="text-xs text-muted-foreground">Kejutan untuk warga</span>
              </div>
            </Link>
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}


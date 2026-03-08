import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Users, ReceiptText, MoreHorizontal, Utensils, Carrot, Store, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export function BottomTabBar() {
  const { isAdmin } = useMember();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const primaryTabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/meal-plan", icon: ClipboardList, label: "Plan", adminOnly: true },
    { to: "/members", icon: Users, label: isAdmin ? "Members" : "Join" },
    { to: "/costs", icon: ReceiptText, label: "Costs" },
  ].filter(tab => !tab.adminOnly || isAdmin);

  const moreLinks = [
    { to: "/menus", icon: Utensils, label: "Menus", description: "Kelola daftar menu masakan" },
    { to: "/ingredients", icon: Carrot, label: "Ingredients", description: "Stok & pembelian bahan" },
    { to: "/suppliers", icon: Store, label: "Vendor", description: "Daftar toko & supplier" },
  ];

  const morePaths = moreLinks.map(l => l.to);
  const isMoreActive = isMoreOpen || morePaths.some(p => location.pathname.startsWith(p));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[100] h-16 sm:h-20 lg:hidden px-2 pb-safe bg-white border-t border-stone-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        <div className="flex h-full items-center justify-around max-w-md mx-auto">
          {primaryTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => setIsMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 transition-all",
                  isActive ? "text-emerald-600" : "text-stone-400 hover:text-stone-600"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "p-1.5 rounded-2xl transition-all duration-300",
                    isActive ? "bg-emerald-50 scale-110" : "bg-transparent scale-100"
                  )}>
                     <tab.icon className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300", isActive && "stroke-[2.5px]")} />
                  </div>
                  <span className={cn(
                    "text-[10px] sm:text-xs transition-all duration-300", 
                    isActive ? "font-black" : "font-semibold"
                  )}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" Tab — admin only */}
          {isAdmin && (
            <button
              onClick={() => setIsMoreOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 transition-all",
                isMoreActive ? "text-emerald-600" : "text-stone-400 hover:text-stone-600"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-2xl transition-all duration-300",
                isMoreActive ? "bg-emerald-50 scale-110" : "bg-transparent scale-100"
              )}>
                <MoreHorizontal className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300", isMoreActive && "stroke-[2.5px]")} />
              </div>
              <span className={cn(
                "text-[10px] sm:text-xs transition-all duration-300",
                isMoreActive ? "font-black" : "font-semibold"
              )}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Bottom Sheet for "More" links */}
      <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl px-6 pt-4 pb-24 max-h-[70vh]">
          {/* Drag handle indicator */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-stone-200" />
          </div>
          <SheetHeader className="p-0 mb-6">
            <SheetTitle className="text-xl font-black text-stone-900 tracking-tight">More</SheetTitle>
            <SheetDescription className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              Halaman admin lainnya
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            {moreLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.to);
              return (
                <button
                  key={link.to}
                  onClick={() => {
                    setIsMoreOpen(false);
                    navigate(link.to);
                  }}
                  className={cn(
                    "flex items-center gap-4 w-full p-4 rounded-2xl transition-all text-left",
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "hover:bg-stone-50 text-stone-700"
                  )}
                >
                  <div className={cn(
                    "p-2.5 rounded-xl shrink-0",
                    isActive ? "bg-emerald-100" : "bg-stone-100"
                  )}>
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm">{link.label}</p>
                    <p className={cn(
                      "text-xs font-medium truncate",
                      isActive ? "text-emerald-500" : "text-stone-400"
                    )}>
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-emerald-400" : "text-stone-300"
                  )} />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

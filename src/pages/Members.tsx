import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { useMember } from "@/hooks/useMember";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, UserCheck, Trash2, CheckCircle2, Circle, Users, LayoutDashboard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Member {
  id: number;
  name: string;
  role: 'superadmin' | 'admin' | 'member';
}

interface Meal {
  id: number;
  date: string;
  day_name: string;
}

interface MealPlan {
  id: number;
  week_start: string;
  week_end: string;
  status: string;
  meals: Meal[];
}

interface Participation {
  meal_id: number;
  member_id: number;
  member_name: string;
  date: string;
  day_name: string;
}

export default function Members() {
  const { member: currentMember, isSuperadmin } = useMember();
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      fetchParticipations(parseInt(selectedPlanId));
    }
  }, [selectedPlanId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mList, pList] = await Promise.all([
        api.get<Member[]>("/members"),
        api.get<MealPlan[]>("/meal-plans")
      ]);
      setMembers(mList);
      setPlans(pList);

      const active = pList.find(p => p.status === 'active') || pList[0];
      if (active) {
        setSelectedPlanId(active.id.toString());
      }
    } catch (err) {
      console.error("Failed to fetch members data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipations = async (planId: number) => {
    try {
      const pList = await api.get<Participation[]>(`/participations/${planId}`);
      setParticipations(pList);
    } catch (err) {
      console.error("Failed to fetch participations:", err);
    }
  };

  const updateRole = async (targetId: number, newRole: string) => {
    if (!currentMember) return;
    try {
      await api.put(`/members/${targetId}/role`, {
        role: newRole,
        requestedBy: currentMember.name
      });
      setMembers(members.map(m => m.id === targetId ? { ...m, role: newRole as any } : m));
      toast.success(`Role ${members.find(m => m.id === targetId)?.name} berhasil diubah.`);
    } catch (err) {
      toast.error("Gagal update role: " + err);
    }
  };

  const deleteMember = async (targetId: number) => {
    if (!confirm("Hapus warga ini? Data partisipasi juga akan hilang.")) return;
    try {
      await api.delete(`/members/${targetId}`);
      setMembers(members.filter(m => m.id !== targetId));
      toast.success("Warga berhasil dihapus.");
    } catch (err) {
      toast.error("Gagal hapus: " + err);
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

  return (
    <PageContainer>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-4 border-b border-stone-100">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-900 tracking-tight">Warga Coliving</h1>
            <p className="text-sm text-stone-400 mt-0.5">
              {members.length} warga terdaftar
            </p>
          </div>
          <Select value={selectedPlanId || ""} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="h-9 w-auto md:w-[180px] bg-stone-50 border-stone-100 rounded-lg font-medium text-xs shadow-none px-3">
              <SelectValue placeholder="Pilih Pekan" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-stone-100">
              {plans.map(p => (
                <SelectItem key={p.id} value={p.id.toString()} className="text-sm">
                  {formatDate(p.week_start)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="grid w-full max-w-xs grid-cols-2 bg-stone-100 p-0.5 h-9 rounded-lg mb-5">
            <TabsTrigger value="grid" className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5">
              <LayoutDashboard className="h-3.5 w-3.5" /> Partisipasi
            </TabsTrigger>
            <TabsTrigger value="list" className="rounded-md text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm gap-1.5">
              <Users className="h-3.5 w-3.5" /> Daftar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-0">
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50/80 border-b border-stone-100">
                      <TableHead className="w-[180px] text-[11px] font-semibold text-stone-400 uppercase tracking-wide h-10">Nama</TableHead>
                      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => (
                        <TableHead key={d} className="text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wide px-2 h-10 w-12">{d}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(m => {
                      const userParts = participations.filter(p => p.member_id === m.id);
                      return (
                        <TableRow key={m.id} className="hover:bg-stone-50/50 transition-colors border-stone-50">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-stone-100 flex items-center justify-center text-[10px] font-semibold text-stone-500 uppercase shrink-0">
                                {m.name.substring(0, 2)}
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-stone-800 truncate block">{m.name}</span>
                                {m.role !== 'member' && (
                                  <span className={cn(
                                    "text-[10px] font-medium leading-tight",
                                    m.role === 'superadmin' ? "text-amber-500" : "text-teal-500"
                                  )}>
                                    {m.role}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(day => {
                            const joined = userParts.some(p => p.day_name === day);
                            return (
                              <TableCell key={day} className="text-center p-0">
                                <div className="flex justify-center">
                                  {joined ? (
                                    <div className="h-7 w-7 bg-primary/8 rounded-lg flex items-center justify-center">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-primary stroke-[2.5px]" />
                                    </div>
                                  ) : (
                                    <Circle className="h-4 w-4 text-stone-200" />
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-stone-400 text-center">
              Centang = terdaftar makan di hari tersebut
            </p>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map(m => (
                <div key={m.id} className="bg-white border border-stone-100 rounded-xl p-4 flex items-center justify-between group hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 text-sm font-semibold uppercase group-hover:bg-primary/8 group-hover:text-primary transition-colors">
                      {m.name.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-stone-800 flex items-center gap-1.5 text-sm">
                        {m.name}
                        {m.role === 'superadmin' && <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />}
                        {m.role === 'admin' && <UserCheck className="h-3.5 w-3.5 text-teal-500" />}
                      </div>
                      <p className="text-[11px] text-stone-400">{m.role}</p>
                    </div>
                  </div>

                  {isSuperadmin && m.role !== 'superadmin' && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.role === 'member' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[11px] font-medium text-teal-600 h-7 px-2 hover:bg-teal-50 rounded-lg"
                          onClick={() => updateRole(m.id, 'admin')}
                        >
                          Set Admin
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[11px] font-medium text-amber-600 h-7 px-2 hover:bg-amber-50 rounded-lg"
                          onClick={() => updateRole(m.id, 'member')}
                        >
                          Demote
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                        onClick={() => deleteMember(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

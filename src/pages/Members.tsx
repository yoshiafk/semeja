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
import { toast } from "sonner";

interface Member {
  id: number;
  name: string;
  role: 'superadmin' | 'admin' | 'member';
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
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const mList = await api.get<Member[]>("/members");
      setMembers(mList);

      const activePlan = await api.get<any>("/meal-plans/active");
      if (activePlan) {
        const pList = await api.get<Participation[]>(`/participations/${activePlan.id}`);
        setParticipations(pList);
      }
    } catch (err) {
      console.error("Failed to fetch members data:", err);
    } finally {
      setLoading(false);
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-100 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-stone-900">Warga Coliving</h1>
            <p className="text-stone-500 font-medium font-medium">Monitoring kehadiran dan manajemen peran warga.</p>
          </div>
          <div className="flex items-center gap-4 bg-stone-50 px-4 py-2 rounded-2xl border border-stone-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Total Warga</span>
              <span className="text-lg font-black text-stone-900">{members.length} Orang</span>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <Users className="h-5 w-5 text-primary/40" />
          </div>
        </div>

        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:max-w-md bg-stone-100 p-1 h-12 mb-8">
            <TabsTrigger value="grid" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <LayoutDashboard className="h-4 w-4" /> Partisipasi
            </TabsTrigger>
            <TabsTrigger value="list" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Users className="h-4 w-4" /> Daftar Warga
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="mt-0">
            <Card className="border-stone-200 shadow-xl shadow-stone-200/50 overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50/50 border-b border-stone-100">
                      <TableHead className="w-[200px] font-black uppercase text-[10px] tracking-widest h-14">Nama Warga</TableHead>
                      {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => (
                        <TableHead key={d} className="text-center text-[10px] font-black uppercase tracking-widest px-2 h-14">{d}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(m => {
                      const userParts = participations.filter(p => p.member_id === m.id);
                      return (
                        <TableRow key={m.id} className="hover:bg-primary/[0.02] transition-colors border-stone-100">
                          <TableCell className="font-bold py-5">
                            <div className="flex flex-col">
                              <span className="text-stone-900">{m.name}</span>
                              {m.role !== 'member' && (
                                <span className={cn(
                                  "text-[8px] uppercase font-black tracking-widest mt-0.5",
                                  m.role === 'superadmin' ? "text-amber-600" : "text-emerald-600"
                                )}>
                                  {m.role}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => {
                            const joined = userParts.some(p => p.day_name === day);
                            return (
                              <TableCell key={day} className="text-center p-0">
                                <div className="flex justify-center">
                                  {joined ? (
                                    <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center">
                                      <CheckCircle2 className="h-4 w-4 text-primary stroke-[3px]" />
                                    </div>
                                  ) : (
                                    <Circle className="h-5 w-5 text-stone-200" />
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
            </Card>
            <p className="mt-6 text-[10px] text-stone-400 uppercase font-black tracking-widest text-center italic">
              * Centang menandakan warga terdaftar di hari tersebut (Siang & Malam)
            </p>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map(m => (
                <Card key={m.id} className="border-stone-200 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group rounded-2xl">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500 font-black text-lg uppercase group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {m.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-black text-stone-900 flex items-center gap-1.5 leading-none mb-1">
                          {m.name}
                          {m.role === 'superadmin' && <ShieldCheck className="h-4 w-4 text-amber-500" />}
                          {m.role === 'admin' && <UserCheck className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">{m.role}</p>
                      </div>
                    </div>

                    {isSuperadmin && m.role !== 'superadmin' && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.role === 'member' ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] font-black uppercase tracking-widest text-emerald-600 h-8 hover:bg-emerald-50"
                            onClick={() => updateRole(m.id, 'admin')}
                          >
                            Set Admin
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[10px] font-black uppercase tracking-widest text-amber-600 h-8 hover:bg-amber-50"
                            onClick={() => updateRole(m.id, 'member')}
                          >
                            Demote
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                          onClick={() => deleteMember(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

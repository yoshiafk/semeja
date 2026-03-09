import { PageContainer } from "@/components/layout/PageContainer";
import { Activity, Sparkles, Calendar, Users, Dumbbell, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="animate-page-in flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        {/* Lucide Icon Composition */}
        <div className="relative w-40 h-40 mb-8">
          {/* Background glow */}
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl" />
          
          {/* Center main icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
            <Activity className="w-10 h-10 text-primary" />
          </div>
          
          {/* Sparkles - top right, animated */}
          <div className="absolute top-2 right-4 animate-pulse">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          
          {/* Calendar - bottom left */}
          <div className="absolute bottom-4 left-2 w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Calendar className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Users - bottom right */}
          <div className="absolute bottom-4 right-2 w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          
          {/* Dumbbell - top left */}
          <div className="absolute top-4 left-4 w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Dumbbell className="w-4 h-4 text-accent-foreground" />
          </div>
          
          {/* Timer - middle right */}
          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Timer className="w-4 h-4 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Segera Hadir! 🚀
        </h1>

        {/* Description */}
        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-2">
          Fitur aktivitas seru seperti lari bareng, badminton, gym session, dan kegiatan coliving lainnya akan segera hadir.
        </p>
        
        <p className="text-muted-foreground/60 text-xs mb-8">
          Tunggu ya, kita lagi siap-siapin yang terbaik buat kamu! ✨
        </p>

        {/* Teaser Features */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-8">
          <FeatureTeaser icon={Dumbbell} label="Gym Bareng" />
          <FeatureTeaser icon={Activity} label="Lari Pagi" />
          <FeatureTeaser icon={Users} label="Badminton" />
          <FeatureTeaser icon={Calendar} label="Event Rutin" />
        </div>

        {/* Back Button */}
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="rounded-xl"
        >
          Kembali ke Beranda
        </Button>
      </div>
    </PageContainer>
  );
}

function FeatureTeaser({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 opacity-60">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

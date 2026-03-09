import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { Header } from "@/components/layout/Header";
import { BottomTabBar} from "@/components/layout/BottomTabBar";
import { NameEntry } from "@/components/layout/NameEntry";
import { Gatekeeper } from "@/components/layout/Gatekeeper";
import { Loader2 } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Members = lazy(() => import("@/pages/Members"));
const Ingredients = lazy(() => import("@/pages/Ingredients"));
const MealPlan = lazy(() => import("@/pages/MealPlan"));
const Costs = lazy(() => import("@/pages/Costs"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Menus = lazy(() => import("@/pages/Menus"));

const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

function App() {
  const { member, loading, isAdmin, hasHouseKey, confirmHouseKey } = useMember();

  if (!hasHouseKey) {
    if (loading) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    return <Gatekeeper onSuccess={confirmHouseKey} />;
  }

  if (!member) {
    return <NameEntry />;
  }

  return (
    <Router>
      <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
        <Toaster
          position="top-center"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            className: "!rounded-xl !border-stone-100 !shadow-lg !text-sm !font-medium",
          }}
        />
        <Header />
        
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/menus" element={<Menus />} />
            
            {/* Admin Protected Routes */}
            <Route 
              path="/meal-plan" 
              element={isAdmin ? <MealPlan /> : <Navigate to="/" />} 
            />
            <Route 
              path="/ingredients" 
              element={isAdmin ? <Ingredients /> : <Navigate to="/" />} 
            />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>

        <BottomTabBar />
        <Analytics />
        <SpeedInsights />
      </div>
    </Router>
  );
}

export default App;

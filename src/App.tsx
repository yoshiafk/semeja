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

// Home
const HomeHub = lazy(() => import("@/pages/HomeHub"));

// Meals Module
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const MealPlan = lazy(() => import("@/pages/MealPlan"));
const Menus = lazy(() => import("@/pages/Menus"));

// Activities Module
const ActivitiesComingSoon = lazy(() => import("@/pages/activities/ComingSoon"));

// Community Module
const Members = lazy(() => import("@/pages/Members"));

// Finance Module
const Costs = lazy(() => import("@/pages/Costs"));
const Ingredients = lazy(() => import("@/pages/Ingredients"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));

// Profile
const Profile = lazy(() => import("@/pages/Profile"));

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
            {/* Home Hub */}
            <Route path="/" element={<HomeHub />} />
            
            {/* Meals Module */}
            <Route path="/meals" element={<Dashboard />} />
            <Route 
              path="/meals/plan" 
              element={isAdmin ? <MealPlan /> : <Navigate to="/meals" />} 
            />
            <Route 
              path="/meals/menus" 
              element={isAdmin ? <Menus /> : <Navigate to="/meals" />} 
            />
            
            {/* Activities Module */}
            <Route path="/activities" element={<ActivitiesComingSoon />} />
            
            {/* Community Module */}
            <Route path="/community/members" element={<Members />} />
            
            {/* Finance Module */}
            <Route path="/finance/costs" element={<Costs />} />
            <Route 
              path="/finance/ingredients" 
              element={isAdmin ? <Ingredients /> : <Navigate to="/finance/costs" />} 
            />
            <Route path="/finance/suppliers" element={<Suppliers />} />
            
            {/* Profile */}
            <Route path="/profile" element={<Profile />} />
            
            {/* Legacy routes - redirect to new paths */}
            <Route path="/members" element={<Navigate to="/community/members" />} />
            <Route path="/costs" element={<Navigate to="/finance/costs" />} />
            <Route path="/suppliers" element={<Navigate to="/finance/suppliers" />} />
            <Route path="/menus" element={<Navigate to="/meals/menus" />} />
            <Route path="/meal-plan" element={<Navigate to="/meals/plan" />} />
            <Route path="/ingredients" element={<Navigate to="/finance/ingredients" />} />
            
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

import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useMember } from "@/hooks/useMember";
import { Header } from "@/components/layout/Header";
import { BottomTabBar} from "@/components/layout/BottomTabBar";
import { NameEntry } from "@/components/layout/NameEntry";
import { Gatekeeper } from "@/components/layout/Gatekeeper";
import { PasswordSetup } from "@/components/layout/PasswordSetup";
import { Loader2 } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";

// Home
const HomeHub = lazy(() => import("@/pages/HomeHub"));

// Meals Module
const Dashboard   = lazy(() => import("@/pages/Dashboard"));
const MealPlan    = lazy(() => import("@/pages/MealPlan"));
const Menus       = lazy(() => import("@/pages/Menus"));
const MealActuals = lazy(() => import("@/pages/MealActuals"));   // #1 calibration
const MealPreview = lazy(() => import("@/pages/MealPreview"));   // #3 pre-meal review

// Activities Module
const ActivitiesList  = lazy(() => import("@/pages/activities"));
const NewActivity     = lazy(() => import("@/pages/activities/new"));
const ActivityDetail  = lazy(() => import("@/pages/activities/detail"));

// Community Module
const Members    = lazy(() => import("@/pages/Members"));
const GiftsList  = lazy(() => import("@/pages/gifts/index.tsx"));
const NewGift    = lazy(() => import("@/pages/gifts/new.tsx"));
const GiftDetail = lazy(() => import("@/pages/gifts/detail.tsx"));

// Finance Module
const Costs       = lazy(() => import("@/pages/Costs"));
const Ingredients = lazy(() => import("@/pages/Ingredients"));
const Suppliers   = lazy(() => import("@/pages/Suppliers"));

// Profile
const Profile = lazy(() => import("@/pages/Profile"));

const PageLoader = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

function App() {
  const {
    member, loading, isAdmin, hasHouseKey,
    needsPasswordSetup, confirmHouseKey, clearPasswordSetup,
  } = useMember();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasHouseKey)      return <Gatekeeper onSuccess={confirmHouseKey} />;
  if (!member)           return <NameEntry />;
  if (needsPasswordSetup) return <PasswordSetup onComplete={clearPasswordSetup} />;

  return (
    <Router>
      <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
        <Toaster
          position="top-center"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            className: "!rounded-xl !border-border/50 !shadow-lg !text-sm !font-medium",
          }}
        />
        <Header />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Home Hub */}
            <Route path="/" element={<HomeHub />} />

            {/* ── Meals Module ───────────────────────────── */}
            <Route path="/meals" element={<Dashboard />} />
            <Route
              path="/meals/plan"
              element={isAdmin ? <MealPlan /> : <Navigate to="/meals" />}
            />
            <Route
              path="/meals/menus"
              element={isAdmin ? <Menus /> : <Navigate to="/meals" />}
            />
            {/* #3  Pre-meal ingredient review (admin) */}
            <Route
              path="/meals/preview"
              element={isAdmin ? <MealPreview /> : <Navigate to="/meals" />}
            />
            {/* #1  Post-meal calibration (admin) */}
            <Route
              path="/meals/actuals"
              element={isAdmin ? <MealActuals /> : <Navigate to="/meals" />}
            />

            {/* ── Activities Module ──────────────────────── */}
            <Route path="/activities"      element={<ActivitiesList />} />
            <Route path="/activities/new"  element={isAdmin ? <NewActivity />   : <Navigate to="/activities" />} />
            <Route path="/activities/:id"  element={<ActivityDetail />} />

            {/* ── Community Module ───────────────────────── */}
            <Route path="/community/members"    element={<Members />} />
            <Route path="/community/gifts"      element={<GiftsList />} />
            <Route path="/community/gifts/new"  element={<NewGift />} />
            <Route path="/community/gifts/:id"  element={<GiftDetail />} />

            {/* ── Finance Module ─────────────────────────── */}
            <Route path="/finance/costs"        element={<Costs />} />
            <Route
              path="/finance/ingredients"
              element={isAdmin ? <Ingredients /> : <Navigate to="/finance/costs" />}
            />
            <Route path="/finance/suppliers"    element={<Suppliers />} />

            {/* Profile */}
            <Route path="/profile" element={<Profile />} />

            {/* Legacy redirects */}
            <Route path="/members"      element={<Navigate to="/community/members" />} />
            <Route path="/costs"        element={<Navigate to="/finance/costs" />} />
            <Route path="/suppliers"    element={<Navigate to="/finance/suppliers" />} />
            <Route path="/menus"        element={<Navigate to="/meals/menus" />} />
            <Route path="/meal-plan"    element={<Navigate to="/meals/plan" />} />
            <Route path="/ingredients"  element={<Navigate to="/finance/ingredients" />} />
            <Route path="/gifts"        element={<Navigate to="/community/gifts" />} />

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

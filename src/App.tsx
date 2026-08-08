import { lazy, Suspense, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
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

// Simple Error Boundary component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-gray-50">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Waduh, ada masalah dikit!</h1>
          <p className="text-gray-600 mb-6 max-w-md">Terjadi kesalahan yang tidak terduga. Silakan coba muat ulang halaman atau hubungi admin jika masalah berlanjut.</p>
          <pre className="p-4 bg-gray-100 rounded text-xs text-left overflow-auto max-w-full mb-6">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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

// Bekal Sehat Module
const BekalSehat = lazy(() => import("@/pages/BekalSehat"));

// Trips Module
const TripsList = lazy(() => import("@/pages/trips/index"));
const TripDetailView = lazy(() => import("@/pages/trips/detail"));

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
      <ErrorBoundary>
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

              {/* ── Bekal Sehat Module ──────────────────────── */}
              <Route path="/bekal-sehat" element={<BekalSehat />} />

              {/* ── Trips Module ─────────────────────────────── */}
              <Route path="/trips" element={<TripsList />} />
              <Route path="/trips/:slug" element={<TripDetailView />} />

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
      </ErrorBoundary>
    </Router>
  );
}

export default App;

import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

import { AppLayout } from "./components/layout/AppLayout";
import { SeoHead } from "./components/SeoHead";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { PageLoader } from "./components/layout/PageLoader";
import { BetaModal } from "./components/BetaModal";

// Public Pages — eager (critical path)
import Landing from "./pages/Landing";
import AuthPage from "./pages/auth/AuthPage";

// Lazy-loaded auth pages
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Lazy-loaded public pages
const Changelog  = lazy(() => import("./pages/Changelog"));
const Status     = lazy(() => import("./pages/Status"));
const TermsPage  = lazy(() => import("./pages/legal/TermsPage"));
const PrivacyPage= lazy(() => import("./pages/legal/PrivacyPage"));
const NotFound   = lazy(() => import("./pages/not-found"));

// Lazy-loaded protected pages
const Dashboard  = lazy(() => import("./pages/Dashboard"));
const Analytics  = lazy(() => import("./pages/Analytics"));
const Reports    = lazy(() => import("./pages/Reports"));
const Chat       = lazy(() => import("./pages/Chat"));
const Profile    = lazy(() => import("./pages/Profile"));

const ProjectList   = lazy(() => import("./pages/projects/ProjectList"));
const ProjectNew    = lazy(() => import("./pages/projects/ProjectNew"));
const ProjectDetail = lazy(() => import("./pages/projects/ProjectDetail"));

const ScanList   = lazy(() => import("./pages/scans/ScanList"));
const ScanDetail = lazy(() => import("./pages/scans/ScanDetail"));
const AttackGraph= lazy(() => import("./pages/scans/AttackGraph"));

const FindingList   = lazy(() => import("./pages/findings/FindingList"));
const FindingDetail = lazy(() => import("./pages/findings/FindingDetail"));

const WorkspaceSettings = lazy(() => import("./pages/settings/WorkspaceSettings"));
const ApiKeys  = lazy(() => import("./pages/settings/ApiKeys"));
const Billing  = lazy(() => import("./pages/settings/Billing"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers     = lazy(() => import("./pages/admin/AdminUsers"));
const AdminCoupons   = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminActivity  = lazy(() => import("./pages/admin/AdminActivity"));
const AdminEmails    = lazy(() => import("./pages/admin/AdminEmails"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 500,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000,       // 2 min — avoid redundant refetches
      gcTime: 10 * 60 * 1000,         // 10 min — keep cache warm
      networkMode: "offlineFirst",     // serve cache instantly, revalidate in bg
    },
    mutations: {
      retry: 0,
      networkMode: "always",
    },
  },
});

function S({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public — eager */}
      <Route path="/" component={Landing} />
      <Route path="/signin">{() => <AuthPage initialMode="signin" />}</Route>
      <Route path="/signup">{() => <AuthPage initialMode="signup" />}</Route>
      <Route path="/auth/forgot-password"><S><ForgotPassword /></S></Route>
      <Route path="/auth/reset-password"><S><ResetPassword /></S></Route>

      {/* Public — lazy */}
      <Route path="/changelog"><S><Changelog /></S></Route>
      <Route path="/status"><S><Status /></S></Route>
      <Route path="/channel"><S><Redirect href="/chat" /></S></Route>
      <Route path="/terms"><S><TermsPage /></S></Route>
      <Route path="/privacy"><S><PrivacyPage /></S></Route>

      {/* Protected — lazy */}
      <Route path="/dashboard"><AppLayout><S><Dashboard /></S></AppLayout></Route>

      <Route path="/projects"><AppLayout><S><ProjectList /></S></AppLayout></Route>
      <Route path="/projects/new"><AppLayout><S><ProjectNew /></S></AppLayout></Route>
      <Route path="/projects/:id"><AppLayout><S><ProjectDetail /></S></AppLayout></Route>

      <Route path="/scans"><AppLayout><S><ScanList /></S></AppLayout></Route>
      <Route path="/scans/:id"><AppLayout><S><ScanDetail /></S></AppLayout></Route>
      <Route path="/scans/:id/attack-graph"><AppLayout><S><AttackGraph /></S></AppLayout></Route>

      <Route path="/findings"><AppLayout><S><FindingList /></S></AppLayout></Route>
      <Route path="/findings/:id"><AppLayout><S><FindingDetail /></S></AppLayout></Route>

      <Route path="/analytics"><AppLayout><S><Analytics /></S></AppLayout></Route>
      <Route path="/reports"><AppLayout><S><Reports /></S></AppLayout></Route>

      <Route path="/settings"><AppLayout><S><WorkspaceSettings /></S></AppLayout></Route>
      <Route path="/settings/api-keys"><AppLayout><S><ApiKeys /></S></AppLayout></Route>
      <Route path="/settings/billing"><AppLayout><S><Billing /></S></AppLayout></Route>

      <Route path="/chat"><AppLayout><S><Chat /></S></AppLayout></Route>
      <Route path="/profile"><AppLayout><S><Profile /></S></AppLayout></Route>

      {/* Admin — lazy */}
      <Route path="/admin"><AdminLayout><S><AdminDashboard /></S></AdminLayout></Route>
      <Route path="/admin/users"><AdminLayout><S><AdminUsers /></S></AdminLayout></Route>
      <Route path="/admin/coupons"><AdminLayout><S><AdminCoupons /></S></AdminLayout></Route>
      <Route path="/admin/activity"><AdminLayout><S><AdminActivity /></S></AdminLayout></Route>
      <Route path="/admin/emails"><AdminLayout><S><AdminEmails /></S></AdminLayout></Route>

      <Route><S><NotFound /></S></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <SeoHead />
        <Router />
      </WouterRouter>
      <VercelAnalytics />
      <BetaModal />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#121212',
            color: '#fff',
            border: '1px solid #27272a',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#121212' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#121212' } },
        }}
      />
    </QueryClientProvider>
  );
}

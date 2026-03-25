import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import TodayInstallments from "./pages/today";
import ClientList from "./pages/client-list";
import ClientDetail from "./pages/client-detail";
import ClientCreate from "./pages/client-create";
import LoanCreate from "./pages/loan-create";
import Cobradores from "./pages/cobradores";
import Billing from "./pages/billing";
import Expenses from "./pages/expenses";
import { AuthGuard } from "./components/layout";
import { PwaInstallBanner } from "./components/pwa-install-banner";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />

      <Route path="/dashboard">
        <AuthGuard><Dashboard /></AuthGuard>
      </Route>
      <Route path="/today">
        <AuthGuard><TodayInstallments /></AuthGuard>
      </Route>
      <Route path="/clients">
        <AuthGuard><ClientList /></AuthGuard>
      </Route>
      <Route path="/clients/new">
        <AuthGuard><ClientCreate /></AuthGuard>
      </Route>
      <Route path="/clients/:id">
        <AuthGuard><ClientDetail /></AuthGuard>
      </Route>
      <Route path="/loans/new">
        <AuthGuard><LoanCreate /></AuthGuard>
      </Route>
      <Route path="/cobradores">
        <AuthGuard><Cobradores /></AuthGuard>
      </Route>
      <Route path="/billing">
        <AuthGuard><Billing /></AuthGuard>
      </Route>
      <Route path="/expenses">
        <AuthGuard><Expenses /></AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        <PwaInstallBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

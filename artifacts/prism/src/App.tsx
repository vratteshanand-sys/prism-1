import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Layout } from '@/components/layout';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

import Dashboard from '@/pages/dashboard';
import SupplyChain from '@/pages/supply-chain';
import Sentinel from '@/pages/sentinel';
import TrustLens from '@/pages/trustlens';
import FinGuard from '@/pages/finguard';
import Reports from '@/pages/reports';
import DeviceScanPage from '@/pages/device-scan';
import GuardPage from '@/pages/guard';
import SharePage from '@/pages/share';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public share page — no sidebar/layout */}
      <Route path="/share/:token" component={SharePage} />
      <Route>
        <Layout>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/supplychain" component={SupplyChain} />
              <Route path="/sentinel" component={Sentinel} />
              <Route path="/trustlens" component={TrustLens} />
              <Route path="/finguard" component={FinGuard} />
              <Route path="/devicescan" component={DeviceScanPage} />
              <Route path="/guard" component={GuardPage} />
              <Route path="/reports" component={Reports} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </Layout>
      </Route>
    </Switch>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

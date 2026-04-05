import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";

// Page imports
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import NewTransaction from "@/pages/new-transaction";
import Gateways from "@/pages/gateways";
import Market from "@/pages/market";
import NewMarketAsset from "@/pages/new-market-asset";
import AiChat from "@/pages/ai-chat";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions/new" component={NewTransaction} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/gateways" component={Gateways} />
        <Route path="/market/new" component={NewMarketAsset} />
        <Route path="/market" component={Market} />
        <Route path="/ai-chat" component={AiChat} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

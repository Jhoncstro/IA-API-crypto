import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ArrowRightLeft, 
  Server, 
  LineChart, 
  Terminal
} from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export function Sidebar() {
  const [location] = useLocation();
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 }
  });

  const links = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
    { href: "/gateways", label: "Gateways", icon: Server },
    { href: "/market", label: "Market", icon: LineChart },
    { href: "/ai-chat", label: "AI Chat", icon: Terminal },
  ];

  return (
    <div className="w-64 border-r bg-sidebar flex flex-col min-h-screen">
      <div className="p-4 border-b border-border/50">
        <h1 className="font-mono font-bold text-xl tracking-tight text-primary">FinanceOps AI</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/50 text-xs text-muted-foreground font-mono text-center flex items-center justify-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", health?.status === "ok" ? "bg-green-500" : "bg-red-500")} />
        SYSTEM: {health?.status === "ok" ? "SECURE" : "DEGRADED"}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

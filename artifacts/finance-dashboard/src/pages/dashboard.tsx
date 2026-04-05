import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTransactionSummary,
  getGetTransactionSummaryQueryKey,
  useListGateways,
  getListGatewaysQueryKey,
  useListMarketAssets,
  getListMarketAssetsQueryKey,
  useListTransactions,
  getListTransactionsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { AlertTriangle, Activity, Server, ArrowUpRight, ArrowDownRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetTransactionSummary({
    query: { queryKey: getGetTransactionSummaryQueryKey() }
  });

  const { data: gateways, isLoading: loadingGateways } = useListGateways({
    query: { queryKey: getListGatewaysQueryKey() }
  });

  const { data: marketAssets, isLoading: loadingAssets } = useListMarketAssets({
    query: { queryKey: getListMarketAssetsQueryKey() }
  });

  const { data: recentTransactions, isLoading: loadingTxs } = useListTransactions({
    query: { queryKey: getListTransactionsQueryKey() }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetTransactionSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListGatewaysQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMarketAssetsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const volumeByTypeData = useMemo(() => {
    if (!summary?.byType) return [];
    return Object.entries(summary.byType).map(([type, count]) => ({
      name: type.toUpperCase(),
      count
    }));
  }, [summary]);

  const riskData = useMemo(() => {
    if (!summary) return [];
    const high = summary.highRiskCount;
    const low = summary.totalCount - high;
    return [
      { name: "Low/Med Risk", value: low, color: "hsl(var(--primary))" },
      { name: "High Risk", value: high, color: "hsl(var(--destructive))" }
    ];
  }, [summary]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live - Auto-refreshing 30s
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary?.totalVolume || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {loadingSummary ? <Skeleton className="h-4 w-[60px]" /> : `${formatNumber(summary?.totalCount || 0)} transactions`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Alerts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{formatNumber(summary?.highRiskCount || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Requiring immediate review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Gateways</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingGateways ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">{gateways?.filter(g => g.status === 'active').length || 0} / {gateways?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Operational nodes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingGateways ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">
                {gateways?.length ? Math.round(gateways.reduce((acc, g) => acc + (g.avgLatencyMs || 0), 0) / gateways.length) : 0}ms
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all gateways</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Volume by Type</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px]">
              {loadingSummary ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeByTypeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {loadingSummary ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Critical Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingTxs ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : recentTransactions?.filter(tx => (tx.riskScore || 0) >= 70).slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-medium">{tx.id}</span>
                    <span className="text-xs text-muted-foreground">{tx.type} • {tx.gateway}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-destructive">{formatCurrency(tx.amount, tx.currency)}</span>
                    <Badge variant="destructive" className="font-mono">{tx.riskScore}</Badge>
                  </div>
                </div>
              ))}
              {recentTransactions?.filter(tx => (tx.riskScore || 0) >= 70).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">No critical transactions</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Market Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loadingAssets ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : marketAssets?.slice(0, 5).map(asset => (
                <div key={asset.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex flex-col">
                    <span className="font-bold">{asset.symbol}</span>
                    <span className="text-xs text-muted-foreground">{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="font-medium">{formatCurrency(asset.currentPrice || 0)}</span>
                      <span className={`text-xs flex items-center ${parseFloat(asset.changePct || '0') >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {parseFloat(asset.changePct || '0') >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {Math.abs(parseFloat(asset.changePct || '0'))}%
                      </span>
                    </div>
                    {asset.aiSignal && (
                      <Badge variant={asset.aiSignal.includes('COMPRA') ? 'default' : asset.aiSignal.includes('VENDA') ? 'destructive' : 'secondary'} className="text-xs">
                        {asset.aiSignal}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListTransactions, getListTransactionsQueryKey, useBatchAnalyzeTransactions } from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, Plus, Activity, Bot, Loader2, Layers } from "lucide-react";
import { Transaction } from "@workspace/api-client-react/src/generated/api.schemas";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";

export default function Transactions() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const queryParams: any = {};
  if (typeFilter !== "all") queryParams.type = typeFilter;
  if (statusFilter !== "all") queryParams.status = statusFilter;

  const { data: transactions, isLoading } = useListTransactions({
    query: { queryKey: getListTransactionsQueryKey(queryParams) },
    request: { query: queryParams }
  });

  const batchAnalyze = useBatchAnalyzeTransactions();

  const handleBatchAnalyze = () => {
    batchAnalyze.mutate({ data: { ids: filteredTransactions.slice(0, 50).map(t => t.id) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      }
    });
  };

  const filteredTransactions = useMemo(() => {

    if (!transactions) return [];
    if (!search) return transactions;
    const lowerSearch = search.toLowerCase();
    return transactions.filter(tx => 
      tx.id.toString().includes(lowerSearch) ||
      tx.fromEntity.toLowerCase().includes(lowerSearch) ||
      tx.toEntity.toLowerCase().includes(lowerSearch) ||
      (tx.gateway && tx.gateway.toLowerCase().includes(lowerSearch))
    );
  }, [transactions, search]);

  const riskData = useMemo(() => {
    if (!transactions) return [];
    const bins = {
      "0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0
    };
    transactions.forEach(tx => {
      const score = tx.riskScore || 0;
      if (score < 20) bins["0-20"]++;
      else if (score < 40) bins["20-40"]++;
      else if (score < 60) bins["40-60"]++;
      else if (score < 80) bins["60-80"]++;
      else bins["80-100"]++;
    });
    return Object.entries(bins).map(([name, count]) => ({ name, count }));
  }, [transactions]);

  const getRiskColor = (score: number) => {
    if (score < 40) return "bg-green-500/10 text-green-500 border-green-500/20";
    if (score < 70) return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    return "bg-red-500/10 text-red-500 border-red-500/20";
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time flow analysis and risk scoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBatchAnalyze} disabled={batchAnalyze.isPending || filteredTransactions.length === 0}>
            {batchAnalyze.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
            Batch Analyze
          </Button>
          <Link href="/transactions/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Transaction
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Card className="col-span-1 md:col-span-3">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Risk Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[120px] pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-center mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ID, entity, gateway..."
            className="pl-8 bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-card">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="swift">SWIFT</SelectItem>
            <SelectItem value="crypto">Crypto</SelectItem>
            <SelectItem value="card">Card</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card">
            <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="suspicious">Suspicious</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <Card className={`flex-1 flex flex-col ${selectedTx ? 'md:w-2/3' : 'w-full'}`}>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="bg-card sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From / To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead className="text-right">Risk Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow 
                      key={tx.id} 
                      className={`cursor-pointer transition-colors ${selectedTx?.id === tx.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedTx(tx)}
                    >
                      <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase text-[10px] tracking-wider">{tx.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        <div className="text-sm font-medium">{tx.fromEntity}</div>
                        <div className="text-xs text-muted-foreground">→ {tx.toEntity}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(tx.amount, tx.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.gateway || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`font-mono ${getRiskColor(tx.riskScore || 0)}`}>
                          {tx.riskScore || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        {selectedTx && (
          <Card className="w-1/3 flex flex-col bg-card/50 border-primary/20 shadow-xl hidden md:flex">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Transaction Details</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">ID: {selectedTx.id}</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTx(null)}>
                  <span className="sr-only">Close</span>
                  &times;
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">From</div>
                    <div className="font-medium break-all">{selectedTx.fromEntity}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">To</div>
                    <div className="font-medium break-all">{selectedTx.toEntity}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Amount</div>
                    <div className="font-bold text-lg text-primary">{formatCurrency(selectedTx.amount, selectedTx.currency)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">Date</div>
                    <div className="font-mono text-xs">{new Date(selectedTx.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-background border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold flex items-center gap-2">
                      <Bot className="w-4 h-4 text-primary" />
                      AI Risk Analysis
                    </div>
                    <Badge variant="outline" className={`font-mono ${getRiskColor(selectedTx.riskScore || 0)}`}>
                      Score: {selectedTx.riskScore || 0}/100
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed mt-4">
                    {selectedTx.aiAnalysis || "No analysis available for this transaction."}
                  </div>
                </div>
                
                {selectedTx.metadata && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Metadata</div>
                    <pre className="p-3 bg-muted rounded-md text-[10px] font-mono overflow-x-auto text-muted-foreground">
                      {JSON.stringify(JSON.parse(selectedTx.metadata), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}

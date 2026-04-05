import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListGateways, getListGatewaysQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Bot, RefreshCw, Server, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Gateway } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Gateways() {
  const queryClient = useQueryClient();
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: gateways, isLoading } = useListGateways({
    query: { queryKey: getListGatewaysQueryKey() }
  });

  const analyzeGateway = async (gateway: Gateway) => {
    setSelectedGateway(gateway);
    setIsAnalyzing(true);
    setAnalysis("");
    
    try {
      const res = await fetch(`/api/finance/gateways/${gateway.id}/analyze`, { method: "POST" });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.content) {
                setAnalysis(prev => prev + event.content);
              }
              if (event.done) {
                setIsAnalyzing(false);
                queryClient.invalidateQueries({ queryKey: getListGatewaysQueryKey() });
              }
            } catch (e) {
              console.error("Error parsing SSE JSON:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gateway Health</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor provider latencies and routing status.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: getListGatewaysQueryKey() })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="col-span-1 md:col-span-2 flex flex-col">
          <CardHeader className="py-4">
            <CardTitle>Connected Nodes</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="bg-card sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full max-w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))
                ) : gateways?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No gateways found.
                    </TableCell>
                  </TableRow>
                ) : (
                  gateways?.map((gw) => {
                    const successRateNum = parseFloat(gw.successRate || "0");
                    return (
                      <TableRow 
                        key={gw.id}
                        className={selectedGateway?.id === gw.id ? 'bg-primary/5' : ''}
                      >
                        <TableCell>
                          <div className="font-semibold">{gw.name}</div>
                          <div className="text-xs text-muted-foreground">{gw.provider}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={gw.status === 'active' ? 'default' : gw.status === 'degraded' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {gw.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={successRateNum} className="h-2 w-[60px]" 
                              indicatorColor={successRateNum > 98 ? 'bg-green-500' : successRateNum > 95 ? 'bg-yellow-500' : 'bg-red-500'} 
                            />
                            <span className="text-xs font-mono">{gw.successRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span className={gw.avgLatencyMs && gw.avgLatencyMs > 1000 ? 'text-destructive font-bold' : ''}>
                            {gw.avgLatencyMs}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(gw.totalVolume || "0")}</div>
                          <div className="text-[10px] text-muted-foreground">{formatNumber(gw.transactionCount || 0)} txs</div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => analyzeGateway(gw)} disabled={isAnalyzing && selectedGateway?.id === gw.id}>
                            {isAnalyzing && selectedGateway?.id === gw.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4 text-primary" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        <Card className="col-span-1 bg-card/50 border-primary/20 flex flex-col">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="w-5 h-5" />
              <CardTitle>AI Diagnostic</CardTitle>
            </div>
            <CardDescription>
              {selectedGateway ? `Analyzing ${selectedGateway.name}` : "Select a gateway to run diagnostics"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 relative p-0">
            {!selectedGateway && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm p-6 text-center">
                <Server className="w-12 h-12 mb-4 opacity-20" />
                Select a gateway to trigger deep AI analysis of its recent performance, error rates, and latency patterns.
              </div>
            )}
            {selectedGateway && (
              <ScrollArea className="h-full w-full p-6">
                <div className={`font-mono text-sm whitespace-pre-wrap ${isAnalyzing ? 'typing-cursor' : ''} text-primary/90 leading-relaxed`}>
                  {analysis || selectedGateway.aiAnalysis || "Initializing diagnostic scan..."}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

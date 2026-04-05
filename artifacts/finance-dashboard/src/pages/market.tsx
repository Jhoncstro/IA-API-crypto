import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListMarketAssets, getListMarketAssetsQueryKey } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Plus, ArrowUpRight, ArrowDownRight, Loader2, LineChart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarketAsset } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Market() {
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingOverview, setIsAnalyzingOverview] = useState(false);

  const { data: assets, isLoading } = useListMarketAssets({
    query: { queryKey: getListMarketAssetsQueryKey() }
  });

  const fetchMarketOverview = async () => {
    setSelectedAsset(null);
    setIsAnalyzingOverview(true);
    setAnalysis("");
    
    try {
      const res = await fetch(`/api/finance/market/overview`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
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
                setIsAnalyzingOverview(false);
              }
            } catch (e) {
              console.error("Error parsing SSE JSON:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Overview failed:", error);
      setIsAnalyzingOverview(false);
    }
  };

  const analyzeAsset = async (asset: MarketAsset) => {
    setSelectedAsset(asset);
    setIsAnalyzing(true);
    setAnalysis("");
    
    try {
      const res = await fetch(`/api/finance/market/${asset.id}/analyze`, { method: "POST" });
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
                queryClient.invalidateQueries({ queryKey: getListMarketAssetsQueryKey() });
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

  const getSignalColor = (signal?: string | null) => {
    if (!signal) return "bg-muted text-muted-foreground";
    if (signal.includes('COMPRA_FORTE')) return "bg-green-600 text-white border-green-600";
    if (signal.includes('COMPRA')) return "bg-green-500/20 text-green-500 border-green-500/30";
    if (signal.includes('VENDA_FORTE')) return "bg-red-600 text-white border-red-600";
    if (signal.includes('VENDA')) return "bg-red-500/20 text-red-500 border-red-500/30";
    return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time asset monitoring and AI predictive signals.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchMarketOverview} disabled={isAnalyzingOverview}>
            {isAnalyzingOverview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LineChart className="w-4 h-4 mr-2" />}
            Market Overview
          </Button>
          <Link href="/market/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Add Asset
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="col-span-1 lg:col-span-2 flex flex-col space-y-4 overflow-hidden">
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="opacity-50">
                    <CardHeader className="pb-2"><Skeleton className="h-6 w-24" /></CardHeader>
                    <CardContent><Skeleton className="h-10 w-32" /></CardContent>
                  </Card>
                ))
              ) : assets?.length === 0 ? (
                <div className="col-span-2 text-center p-12 text-muted-foreground border border-dashed rounded-lg">
                  No market assets tracked. Add one to begin monitoring.
                </div>
              ) : (
                assets?.map((asset) => {
                  const changeNum = parseFloat(asset.changePct || "0");
                  const isPositive = changeNum >= 0;
                  const isSelected = selectedAsset?.id === asset.id;
                  
                  return (
                    <Card 
                      key={asset.id} 
                      className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : ''}`}
                      onClick={() => analyzeAsset(asset)}
                    >
                      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-xl font-bold">{asset.symbol}</CardTitle>
                          <CardDescription className="text-xs">{asset.name}</CardDescription>
                        </div>
                        <Badge className={`text-[10px] font-bold tracking-widest ${getSignalColor(asset.aiSignal)}`}>
                          {asset.aiSignal || 'PENDING'}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline justify-between mt-2">
                          <div className="text-2xl font-bold tracking-tight">
                            {formatCurrency(asset.currentPrice || "0")}
                          </div>
                          <div className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-500' : 'text-destructive'}`}>
                            {isPositive ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                            {Math.abs(changeNum)}%
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                          <span className="uppercase tracking-wider">{asset.assetType}</span>
                          {isAnalyzing && isSelected ? (
                            <span className="flex items-center text-primary animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</span>
                          ) : (
                            <span className="flex items-center hover:text-primary transition-colors"><Bot className="w-3 h-3 mr-1" /> View Insights</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <Card className="col-span-1 bg-card/50 border-primary/20 flex flex-col">
          <CardHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="w-5 h-5" />
              <CardTitle>Market Insights</CardTitle>
            </div>
            <CardDescription>
              {selectedAsset ? `Predictive analysis for ${selectedAsset.symbol}` : "Select an asset for AI deep dive"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 relative p-0">
            {!selectedAsset && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm p-6 text-center">
                <LineChart className="w-12 h-12 mb-4 opacity-20" />
                Select an asset to trigger an AI evaluation of price action, market sentiment, and forward-looking signals.
              </div>
            )}
            {selectedAsset && (
              <ScrollArea className="h-full w-full p-6">
                <div className={`font-mono text-sm whitespace-pre-wrap ${isAnalyzing ? 'typing-cursor' : ''} text-primary/90 leading-relaxed`}>
                  {analysis || selectedAsset.aiAnalysis || "Initializing market sweep..."}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

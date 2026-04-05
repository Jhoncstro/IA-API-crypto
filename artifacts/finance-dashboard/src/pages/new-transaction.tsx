import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTransaction, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const schema = z.object({
  fromEntity: z.string().min(1, "Required"),
  toEntity: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  currency: z.string().min(1, "Required"),
  type: z.string().min(1, "Required"),
  gateway: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

export default function NewTransaction() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const createTx = useCreateTransaction();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromEntity: "",
      toEntity: "",
      amount: "",
      currency: "USD",
      type: "wire_transfer",
      gateway: "Stripe",
    }
  });

  const onSubmit = async (values: FormValues) => {
    setIsAnalyzing(true);
    setAnalysis("");
    setAnalysisDone(false);

    createTx.mutate({ data: { ...values, status: 'pending' } }, {
      onSuccess: async (tx) => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        
        // Trigger SSE analysis
        try {
          const res = await fetch(`/api/finance/transactions/${tx.id}/analyze`, { method: "POST" });
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
                    if (scrollRef.current) {
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                  }
                  if (event.done) {
                    setIsAnalyzing(false);
                    setAnalysisDone(true);
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
          setAnalysisDone(true);
        }
      },
      onError: () => {
        setIsAnalyzing(false);
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/transactions")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Submit Transaction</h1>
          <p className="text-muted-foreground text-sm mt-1">Input details for real-time AI risk evaluation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
            <CardDescription>Enter the raw payment data.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fromEntity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Entity</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp" {...field} disabled={isAnalyzing || analysisDone} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toEntity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Entity</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Global Tech LLC" {...field} disabled={isAnalyzing || analysisDone} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000000" {...field} disabled={isAnalyzing || analysisDone} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnalyzing || analysisDone}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="BRL">BRL</SelectItem>
                            <SelectItem value="BTC">BTC</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnalyzing || analysisDone}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="swift">SWIFT</SelectItem>
                            <SelectItem value="crypto">Crypto</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gateway"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gateway</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isAnalyzing || analysisDone}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gateway" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Stripe">Stripe</SelectItem>
                            <SelectItem value="Adyen">Adyen</SelectItem>
                            <SelectItem value="PayPal">PayPal</SelectItem>
                            <SelectItem value="SwiftNet">SwiftNet</SelectItem>
                            <SelectItem value="Binance">Binance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border/50 pt-6">
                <Button variant="outline" type="button" onClick={() => {
                  form.reset();
                  setAnalysis("");
                  setAnalysisDone(false);
                }} disabled={isAnalyzing}>Reset</Button>
                <Button type="submit" disabled={isAnalyzing || analysisDone || createTx.isPending}>
                  {(isAnalyzing || createTx.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit & Analyze
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="bg-card/50 border-primary/20 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Bot className="w-5 h-5" />
              <CardTitle>AI Risk Engine</CardTitle>
            </div>
            <CardDescription>Live streaming evaluation</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px] relative">
            {!analysis && !isAnalyzing && !analysisDone && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                Awaiting transaction submission...
              </div>
            )}
            <ScrollArea className="h-full w-full rounded-md border border-border/50 bg-background/50 p-4" ref={scrollRef as any}>
              <div className={`font-mono text-sm whitespace-pre-wrap ${isAnalyzing ? 'typing-cursor' : ''} text-primary/90 leading-relaxed`}>
                {analysis}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

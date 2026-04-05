import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMarketAsset, getListMarketAssetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Target } from "lucide-react";

const schema = z.object({
  symbol: z.string().min(1, "Required").toUpperCase(),
  name: z.string().min(1, "Required"),
  assetType: z.string().min(1, "Required"),
  currentPrice: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewMarketAsset() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createAsset = useCreateMarketAsset();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symbol: "",
      name: "",
      assetType: "stock",
      currentPrice: "",
    }
  });

  const onSubmit = (values: FormValues) => {
    createAsset.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMarketAssetsQueryKey() });
        setLocation("/market");
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setLocation("/market")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Track New Asset</h1>
          <p className="text-muted-foreground text-sm mt-1">Add a market vehicle to the intelligence engine.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Target className="w-5 h-5" />
            <CardTitle>Asset Definition</CardTitle>
          </div>
          <CardDescription>Enter the ticker and metadata to begin tracking.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol / Ticker</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. AAPL, BTC-USD" {...field} className="uppercase" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Class</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="stock">Stock/Equity</SelectItem>
                          <SelectItem value="crypto">Cryptocurrency</SelectItem>
                          <SelectItem value="forex">FX Pair</SelectItem>
                          <SelectItem value="commodity">Commodity</SelectItem>
                          <SelectItem value="index">Index</SelectItem>
                          <SelectItem value="etf">ETF</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company / Asset Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Apple Inc, Bitcoin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Price (Optional Override)</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="Auto-fetched if left blank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border/50 pt-6">
              <Button type="submit" disabled={createAsset.isPending}>
                {createAsset.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Initialize Tracking
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}

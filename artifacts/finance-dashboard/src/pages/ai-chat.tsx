import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateOpenaiConversation, 
  useListOpenaiMessages, 
  getListOpenaiMessagesQueryKey,
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Terminal, Loader2, Bot, User } from "lucide-react";

export default function AiChat() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createConv = useCreateOpenaiConversation();

  // Create a conversation on mount if none exists
  useEffect(() => {
    if (!conversationId && !createConv.isPending) {
      createConv.mutate({ data: { title: "FinOps Terminal Session" } }, {
        onSuccess: (data) => {
          setConversationId(data.id);
        }
      });
    }
  }, [conversationId, createConv]);

  const { data: messages, isLoading: loadingMessages } = useListOpenaiMessages(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getListOpenaiMessagesQueryKey(conversationId!) } }
  );

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Scroll to bottom when messages update or streaming content changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversationId || isStreaming) return;

    const userMessage = input;
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message via cache manipulation if needed, but for simplicity we'll just wait for the SSE stream to finish and invalidate
    // But to make it feel fast, we really should see our message instantly.
    // Instead of complex cache mutation, we just rely on the API to return it fast, or we can just append it locally to a separate state, but the prompt says use SSE directly.
    
    // We invalidate to show the user message immediately while SSE streams the response
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
    }, 500);

    try {
      const res = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage })
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
                setStreamingMessage(prev => prev + event.content);
              }
              if (event.done) {
                setIsStreaming(false);
                queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
                setStreamingMessage("");
              }
            } catch (e) {
              console.error("Error parsing SSE JSON:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat failed:", error);
      setIsStreaming(false);
    }
    
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col space-y-4 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-2">
        <Terminal className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-mono text-primary">FinOps_Terminal</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Encrypted AI Command Interface</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 bg-black border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.1)]">
        <CardHeader className="border-b border-primary/20 py-3 bg-primary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-mono font-normal text-primary/80 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              SESSION_ID: {conversationId ? `SECURE-${conversationId}` : 'INITIALIZING...'}
            </CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 relative overflow-hidden">
          {!conversationId ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <ScrollArea className="h-full p-4 md:p-6" ref={scrollRef as any}>
              <div className="space-y-6 pb-4 font-mono text-sm">
                <div className="text-primary/60 border-b border-primary/20 pb-4 mb-6">
                  System initialized. Access granted to transaction flows, market feeds, and risk scoring engines.
                  Awaiting command...
                </div>

                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 text-xs opacity-70 ${msg.role === 'user' ? 'text-white' : 'text-primary'}`}>
                      {msg.role === 'user' ? (
                        <>USER <User className="w-3 h-3" /></>
                      ) : (
                        <><Bot className="w-3 h-3" /> SYSTEM</>
                      )}
                    </div>
                    <div 
                      className={`max-w-[85%] rounded p-3 whitespace-pre-wrap leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-muted/30 text-white' 
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isStreaming && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1 text-xs opacity-70 text-primary">
                      <Bot className="w-3 h-3" /> SYSTEM
                    </div>
                    <div className="max-w-[85%] rounded p-3 whitespace-pre-wrap leading-relaxed bg-primary/10 text-primary border border-primary/20 typing-cursor">
                      {streamingMessage}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
        
        <CardFooter className="border-t border-primary/20 p-4 bg-primary/5">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono text-sm">{'>'}</span>
              <Input 
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter query or command..." 
                disabled={!conversationId || isStreaming}
                className="pl-8 bg-black border-primary/40 focus-visible:ring-primary font-mono text-primary placeholder:text-primary/30 rounded-none h-12"
              />
            </div>
            <Button 
              type="submit" 
              disabled={!input.trim() || !conversationId || isStreaming}
              className="rounded-none h-12 px-6 bg-primary text-black hover:bg-primary/90 font-mono font-bold"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

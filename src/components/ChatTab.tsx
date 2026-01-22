import { useState, useRef, useEffect } from 'react';
import { Send, MapPin, IndianRupee, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage, BusinessAnalysis } from '@/types/analysis';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { VerdictCard } from './VerdictCard';
import { ChatGreeting } from './ChatGreeting';
import { useAuth } from '@/hooks/useAuth';

interface ChatTabProps {
  onAnalysisComplete: (analysis: BusinessAnalysis) => void;
}

export function ChatTab({ onAnalysisComplete }: ChatTabProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save analysis to database if user is logged in
  const saveAnalysis = async (analysis: BusinessAnalysis, businessIdea: string) => {
    if (!user) return;

    try {
      const insertData = {
        user_id: user.id,
        business_idea: businessIdea,
        location: location || null,
        budget: budget || null,
        verdict: analysis.verdict,
        score: analysis.score,
        summary: analysis.summary,
        analysis_data: JSON.parse(JSON.stringify(analysis)),
        ai_model_used: 'gemini',
      };
      
      const { error } = await supabase.from('business_analyses').insert(insertData);
      if (error) {
        console.error('Failed to save analysis:', error);
      }
    } catch (error) {
      console.error('Failed to save analysis:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setShowGreeting(false);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-business', {
        body: {
          businessIdea: currentInput,
          location: location || 'Not specified',
          budget: budget || 'Not specified',
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const analysis = data as BusinessAnalysis;
      onAnalysisComplete(analysis);

      // Save to database
      await saveAnalysis(analysis, currentInput);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: analysis.summary,
        analysis,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ ${error instanceof Error ? error.message : 'Analysis failed. Please try again.'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Location & Budget Inputs */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Location (e.g., Koramangala, Bangalore)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="pl-10 bg-secondary/30 border-border/50"
          />
        </div>
        <div className="flex-1 relative">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Budget (e.g., ₹15 lakhs)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="pl-10 bg-secondary/30 border-border/50"
          />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* Auto-greeting on first load */}
        {showGreeting && messages.length === 0 && <ChatGreeting />}

        {messages.length === 0 && !showGreeting && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">Describe Your Business Idea</h3>
            <p className="text-muted-foreground max-w-md">
              Enter your business concept, and I'll provide a comprehensive feasibility analysis with
              market insights, financial projections, and expert recommendations.
            </p>
            <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
              <p className="font-mono">💡 Example: "I want to start a cloud kitchen for healthy meals in Koramangala"</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'fade-in',
              message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] p-4',
                message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {message.analysis && (
                <div className="mt-4">
                  <VerdictCard analysis={message.analysis} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Analyzing your business idea...</span>
              </div>
              <div className="typing-dots mt-2">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <Textarea
          placeholder="Describe your business idea in detail..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 min-h-[60px] max-h-[120px] resize-none bg-secondary/30 border-border/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="self-end px-6"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

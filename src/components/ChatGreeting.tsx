import { Brain, Sparkles } from 'lucide-react';

const greetings = [
  "Hi 👋",
  "Hello! What can I help you with today?",
  "Welcome to BizFeasibility AI! Ready to analyze your business idea?",
  "Hey there! Let's evaluate your business concept together.",
];

export function ChatGreeting() {
  // Use a consistent greeting based on the day
  const greetingIndex = new Date().getDate() % greetings.length;
  
  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="chat-bubble-ai p-4 max-w-[80%]">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 shrink-0">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium mb-2">{greetings[greetingIndex]}</p>
            <p className="text-muted-foreground text-sm">
              I'm your AI-powered business analyst. Share your business idea along with:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                Location (city/area)
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                Budget range
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-primary" />
                Target audience
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              I'll provide a comprehensive feasibility analysis with market insights, 
              financial projections, and expert recommendations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

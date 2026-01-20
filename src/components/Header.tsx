import { Brain, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenTestSuite: () => void;
}

const tabs = [
  { id: 'chat', label: 'Chat' },
  { id: 'competition', label: 'Competition' },
  { id: 'budget', label: 'Budget Plan' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'dashboard', label: 'Dashboard' },
];

export function Header({ activeTab, onTabChange, onOpenTestSuite }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">BizFeasibility AI</h1>
            <p className="text-xs text-muted-foreground">Explainable Business Analysis</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-secondary/30 border border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenTestSuite}
          className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
        >
          <FlaskConical className="w-4 h-4" />
          Test Suite
        </Button>
      </div>
    </header>
  );
}

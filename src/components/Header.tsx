import { Brain, FlaskConical, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenTestSuite: () => void;
}

const tabs = [
  { id: 'chat', label: 'Chat' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'market', label: 'Market' },
  { id: 'competition', label: 'Competition' },
  { id: 'profitloss', label: 'Profit & Loss' },
  { id: 'roadmap', label: 'Roadmap' },
];

export function Header({ activeTab, onTabChange, onOpenTestSuite }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">BizFeasibility AI</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Explainable Business Analysis</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-xl bg-secondary/30 border border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'nav-tab',
                activeTab === tab.id && 'nav-tab-active'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenTestSuite}
            className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
          >
            <FlaskConical className="w-4 h-4" />
            Test Suite
          </Button>
          <UserMenu />
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <UserMenu />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
          <nav className="container py-4 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/20 text-primary font-medium'
                    : 'hover:bg-secondary/50'
                )}
              >
                {tab.label}
              </button>
            ))}
            <div className="pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenTestSuite();
                  setMobileMenuOpen(false);
                }}
                className="w-full gap-2 border-primary/30"
              >
                <FlaskConical className="w-4 h-4" />
                Test Suite
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

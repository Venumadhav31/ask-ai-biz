import { useState } from 'react';
import { X, Play, CheckCircle2, XCircle, Clock, Loader2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { testScenarios, TestScenario } from '@/data/testScenarios';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TestResult {
  scenarioId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  actualVerdict?: 'GO' | 'CAUTION' | 'AVOID';
  score?: number;
  error?: string;
}

interface TestSuiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestSuiteModal({ open, onOpenChange }: TestSuiteModalProps) {
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);

  const runSingleTest = async (scenario: TestScenario): Promise<TestResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-business', {
        body: {
          businessIdea: scenario.businessIdea,
          location: scenario.location,
          budget: scenario.budget,
        },
      });

      if (error || data.error) {
        return {
          scenarioId: scenario.id,
          status: 'failed',
          error: error?.message || data?.error || 'Unknown error',
        };
      }

      const passed = data.verdict === scenario.expectedVerdict;
      return {
        scenarioId: scenario.id,
        status: passed ? 'passed' : 'failed',
        actualVerdict: data.verdict,
        score: data.score,
      };
    } catch (err) {
      return {
        scenarioId: scenario.id,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    // Initialize all as pending
    const initialResults = new Map<string, TestResult>();
    testScenarios.forEach((s) => {
      initialResults.set(s.id, { scenarioId: s.id, status: 'pending' });
    });
    setResults(initialResults);

    // Run tests sequentially to avoid rate limits
    for (const scenario of testScenarios) {
      setCurrentTest(scenario.id);
      setResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(scenario.id, { scenarioId: scenario.id, status: 'running' });
        return newMap;
      });

      const result = await runSingleTest(scenario);
      setResults((prev) => {
        const newMap = new Map(prev);
        newMap.set(scenario.id, result);
        return newMap;
      });

      // Small delay between tests
      await new Promise((r) => setTimeout(r, 500));
    }

    setCurrentTest(null);
    setIsRunning(false);
  };

  const getPassRate = () => {
    const passed = Array.from(results.values()).filter((r) => r.status === 'passed').length;
    const total = results.size;
    return total > 0 ? Math.round((passed / total) * 100) : 0;
  };

  const getCategoryStats = () => {
    const categories = new Map<string, { total: number; passed: number }>();
    testScenarios.forEach((s) => {
      const result = results.get(s.id);
      const current = categories.get(s.category) || { total: 0, passed: 0 };
      current.total++;
      if (result?.status === 'passed') current.passed++;
      categories.set(s.category, current);
    });
    return categories;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              India Business Test Suite
              <Badge variant="outline">{testScenarios.length} scenarios</Badge>
            </DialogTitle>
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>

          {results.size > 0 && (
            <div className="mt-4 flex gap-4 p-4 rounded-lg bg-secondary/30">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{getPassRate()}%</p>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
              <div className="flex-1 flex flex-wrap gap-2">
                {Array.from(getCategoryStats()).map(([cat, stats]) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}: {stats.passed}/{stats.total}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogHeader>

        <ScrollArea className="h-[60vh] p-6 pt-4">
          <div className="space-y-3">
            {testScenarios.map((scenario) => {
              const result = results.get(scenario.id);
              return (
                <div
                  key={scenario.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all',
                    result?.status === 'passed' && 'bg-go/10 border-go/30',
                    result?.status === 'failed' && 'bg-avoid/10 border-avoid/30',
                    result?.status === 'running' && 'bg-primary/10 border-primary/30',
                    (!result || result.status === 'pending') && 'bg-secondary/30 border-border/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{scenario.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {scenario.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{scenario.businessIdea}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>📍 {scenario.location}</span>
                        <span>💰 {scenario.budget}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        className={cn(
                          'mb-2',
                          scenario.expectedVerdict === 'GO' && 'bg-go/20 text-go border-go/30',
                          scenario.expectedVerdict === 'CAUTION' && 'bg-caution/20 text-caution border-caution/30',
                          scenario.expectedVerdict === 'AVOID' && 'bg-avoid/20 text-avoid border-avoid/30'
                        )}
                      >
                        Expected: {scenario.expectedVerdict}
                      </Badge>

                      {result && (
                        <div className="flex items-center justify-end gap-2">
                          {result.status === 'pending' && (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          )}
                          {result.status === 'running' && (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          )}
                          {result.status === 'passed' && (
                            <CheckCircle2 className="w-4 h-4 text-go" />
                          )}
                          {result.status === 'failed' && (
                            <>
                              <XCircle className="w-4 h-4 text-avoid" />
                              {result.actualVerdict && (
                                <span className="text-xs">Got: {result.actualVerdict}</span>
                              )}
                            </>
                          )}
                          {result.score !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              ({result.score}/100)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

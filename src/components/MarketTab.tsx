import { TrendingUp, Target, BarChart3, Globe, Info } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MarketTabProps {
  analysis: BusinessAnalysis | null;
}

export function MarketTab({ analysis }: MarketTabProps) {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <TrendingUp className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground max-w-md">
          Submit a business idea in the Chat tab to see market analysis.
        </p>
      </div>
    );
  }

  const { marketAnalysis, competitionAnalysis } = analysis;

  const getCompetitionColor = (level: string) => {
    const lower = level.toLowerCase();
    if (lower.includes('high') || lower.includes('intense')) return 'text-avoid';
    if (lower.includes('moderate') || lower.includes('medium')) return 'text-caution';
    return 'text-go';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/20 border border-primary/30">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Market Size</p>
                <p className="text-2xl font-bold">{marketAnalysis.size}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-go/20 border border-go/30">
                <TrendingUp className="w-6 h-6 text-go" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Growth Rate</p>
                <p className="text-2xl font-bold text-go">{marketAnalysis.growth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-caution/20 border border-caution/30">
                <BarChart3 className="w-6 h-6 text-caution" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Competition Level</p>
                <p className={cn('text-2xl font-bold', getCompetitionColor(marketAnalysis.competition))}>
                  {marketAnalysis.competition}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Analysis Detail */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Market Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-muted-foreground leading-relaxed">{marketAnalysis.explanation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities & Threats Quick View */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-go" />
              Market Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {competitionAnalysis.opportunities.slice(0, 4).map((opportunity, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-go/10 border border-go/20">
                  <span className="w-6 h-6 rounded-full bg-go/20 flex items-center justify-center text-xs font-medium shrink-0 text-go">
                    {index + 1}
                  </span>
                  <span className="text-sm">{opportunity}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Key Market Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium mb-1">Competitive Advantage</p>
                <p className="text-sm text-muted-foreground">{competitionAnalysis.competitiveAdvantage}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Direct Competitors</span>
                  <Badge variant="outline">{competitionAnalysis.directCompetitors}</Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Indirect Competitors</span>
                  <Badge variant="outline">{competitionAnalysis.indirectCompetitors}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

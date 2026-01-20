import { LayoutDashboard, TrendingUp, Users, AlertTriangle, Target, Lightbulb, Quote } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerdictCard } from './VerdictCard';
import { entrepreneurQuotes } from '@/data/testScenarios';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';

interface DashboardTabProps {
  analysis: BusinessAnalysis | null;
}

export function DashboardTab({ analysis }: DashboardTabProps) {
  const randomQuote = useMemo(() => {
    return entrepreneurQuotes[Math.floor(Math.random() * entrepreneurQuotes.length)];
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <LayoutDashboard className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground max-w-md">
          Submit a business idea in the Chat tab to see the full dashboard.
        </p>
        
        {/* Quote */}
        <div className="mt-12 max-w-lg p-6 rounded-xl bg-secondary/30 border border-border/50">
          <Quote className="w-8 h-8 text-primary/50 mb-4" />
          <p className="text-lg italic mb-2">"{randomQuote.quote}"</p>
          <p className="text-sm text-muted-foreground">— {randomQuote.author}</p>
        </div>
      </div>
    );
  }

  const { marketAnalysis, financialProjection, competitionAnalysis, risks, recommendations, expertInsights } = analysis;

  const cumulativeData = financialProjection.yearlyData.reduce((acc: any[], year, index) => {
    const cumRevenue = (acc[index - 1]?.cumRevenue || 0) + year.revenue;
    const cumProfit = (acc[index - 1]?.cumProfit || 0) + year.profit;
    return [...acc, {
      year: year.year.toString(),
      Revenue: year.revenue,
      Profit: year.profit,
      cumRevenue,
      cumProfit,
    }];
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Verdict */}
      <VerdictCard analysis={analysis} />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">Market Size</p>
            </div>
            <p className="text-xl font-bold">{marketAnalysis.size}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-go" />
              <p className="text-sm text-muted-foreground">Growth Rate</p>
            </div>
            <p className="text-xl font-bold text-go">{marketAnalysis.growth}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-caution" />
              <p className="text-sm text-muted-foreground">Competitors</p>
            </div>
            <p className="text-xl font-bold">
              {competitionAnalysis.directCompetitors + competitionAnalysis.indirectCompetitors}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-avoid" />
              <p className="text-sm text-muted-foreground">High Risks</p>
            </div>
            <p className="text-xl font-bold">
              {risks.filter((r) => r.severity === 'high').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            5-Year Revenue & Profit Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={formatCurrency} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area
                  type="monotone"
                  dataKey="Revenue"
                  stroke="hsl(var(--chart-1))"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="Profit"
                  stroke="hsl(var(--chart-2))"
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expert Insights */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-caution" />
            Expert Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <p className="text-muted-foreground whitespace-pre-wrap">{expertInsights}</p>
          </div>
        </CardContent>
      </Card>

      {/* Top Recommendations */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-go" />
            Top 3 Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec, index) => (
              <div key={index} className="p-4 rounded-lg bg-go/10 border border-go/20">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-go/20 text-go font-bold mb-3">
                  {index + 1}
                </span>
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quote */}
      <div className="p-6 rounded-xl bg-secondary/30 border border-border/50 text-center">
        <Quote className="w-8 h-8 text-primary/50 mx-auto mb-4" />
        <p className="text-lg italic mb-2">"{randomQuote.quote}"</p>
        <p className="text-sm text-muted-foreground">— {randomQuote.author}</p>
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-lg bg-caution/10 border border-caution/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-caution mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-caution mb-1">Important Disclaimer</p>
            <p className="text-sm text-muted-foreground">
              This AI-generated analysis is for informational purposes only and should not be considered as financial,
              legal, or professional business advice. Always consult with qualified professionals before making
              investment decisions. Market conditions can change rapidly, and past projections do not guarantee future
              results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

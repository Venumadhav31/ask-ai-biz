import { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, TrendingUp, Users, AlertTriangle, Target, Lightbulb, Quote, Calendar } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerdictCard } from './VerdictCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const entrepreneurQuotes = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" },
];
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DashboardTabProps {
  analysis: BusinessAnalysis | null;
}

interface MarketTrend {
  year: number;
  month: number;
  sector: string;
  market_size: number | null;
  growth_rate: number | null;
  investment_volume: number | null;
}

export function DashboardTab({ analysis }: DashboardTabProps) {
  const [historicalTrends, setHistoricalTrends] = useState<MarketTrend[]>([]);
  const [trendView, setTrendView] = useState<'yearly' | 'monthly'>('yearly');

  const randomQuote = useMemo(() => {
    return entrepreneurQuotes[Math.floor(Math.random() * entrepreneurQuotes.length)];
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  useEffect(() => {
    fetchHistoricalTrends();
  }, []);

  const fetchHistoricalTrends = async () => {
    const { data, error } = await supabase
      .from('market_trends')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (!error && data) {
      setHistoricalTrends(data);
    }
  };

  // Process historical data for charts
  const yearlyTrendData = useMemo(() => {
    const yearlyMap = new Map<number, { foodBev: number; tech: number; foodGrowth: number; techGrowth: number }>();
    
    historicalTrends.forEach((trend) => {
      if (!yearlyMap.has(trend.year)) {
        yearlyMap.set(trend.year, { foodBev: 0, tech: 0, foodGrowth: 0, techGrowth: 0 });
      }
      const entry = yearlyMap.get(trend.year)!;
      if (trend.sector === 'Food & Beverage') {
        entry.foodBev = trend.market_size || 0;
        entry.foodGrowth = trend.growth_rate || 0;
      } else if (trend.sector === 'Technology') {
        entry.tech = trend.market_size || 0;
        entry.techGrowth = trend.growth_rate || 0;
      }
    });

    return Array.from(yearlyMap.entries()).map(([year, data]) => ({
      year: year.toString(),
      'Food & Beverage': data.foodBev,
      'Technology': data.tech,
      'F&B Growth %': data.foodGrowth,
      'Tech Growth %': data.techGrowth,
    }));
  }, [historicalTrends]);

  const monthlyTrendData = useMemo(() => {
    return historicalTrends
      .filter((t) => t.year >= 2023)
      .map((t) => ({
        period: `${t.year}-${String(t.month).padStart(2, '0')}`,
        sector: t.sector,
        marketSize: t.market_size || 0,
        growth: t.growth_rate || 0,
      }));
  }, [historicalTrends]);

  if (!analysis) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Empty state header */}
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <LayoutDashboard className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
          <p className="text-muted-foreground max-w-md">
            Submit a business idea in the Chat tab to see the full dashboard.
          </p>
        </div>

        {/* Historical Trends - Always visible */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Historical Market Trends (2019-2025)
              </CardTitle>
              <Tabs value={trendView} onValueChange={(v) => setTrendView(v as 'yearly' | 'monthly')}>
                <TabsList className="bg-secondary/30">
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {trendView === 'yearly' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={yearlyTrendData}>
                    <defs>
                      <linearGradient id="colorFoodBev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTech" x1="0" y1="0" x2="0" y2="1">
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
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Food & Beverage"
                      stroke="hsl(var(--chart-1))"
                      fillOpacity={1}
                      fill="url(#colorFoodBev)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Technology"
                      stroke="hsl(var(--chart-2))"
                      fillOpacity={1}
                      fill="url(#colorTech)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData.filter((d) => d.sector === 'Technology')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => `${value}%`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="growth"
                      name="Growth Rate %"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quote */}
        <div className="p-6 rounded-xl bg-secondary/30 border border-border/50 text-center">
          <Quote className="w-8 h-8 text-primary/50 mx-auto mb-4" />
          <p className="text-lg italic mb-2">"{randomQuote.quote}"</p>
          <p className="text-sm text-muted-foreground">— {randomQuote.author}</p>
        </div>
      </div>
    );
  }

  const { marketAnalysis, financialProjection, competitionAnalysis, risks, recommendations, expertInsights } = analysis;

  // Dynamic break-even calculation based on financial projection
  const calculateBreakEven = () => {
    const yearlyData = financialProjection.yearlyData;
    let cumulativeProfit = 0;
    let breakEvenMonth = 0;

    for (let yearIndex = 0; yearIndex < yearlyData.length; yearIndex++) {
      const year = yearlyData[yearIndex];
      if (year.months) {
        for (let monthIndex = 0; monthIndex < year.months.length; monthIndex++) {
          cumulativeProfit += year.months[monthIndex].profit;
          breakEvenMonth++;
          if (cumulativeProfit >= 0) {
            return breakEvenMonth;
          }
        }
      } else {
        // Estimate monthly from yearly
        const monthlyProfit = year.profit / 12;
        for (let m = 0; m < 12; m++) {
          cumulativeProfit += monthlyProfit;
          breakEvenMonth++;
          if (cumulativeProfit >= 0) {
            return breakEvenMonth;
          }
        }
      }
    }
    return financialProjection.breakEvenMonths; // Fallback to AI-provided value
  };

  const dynamicBreakEven = calculateBreakEven();

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
              <p className="text-sm text-muted-foreground">Break-even</p>
            </div>
            <p className="text-xl font-bold text-go">{dynamicBreakEven} months</p>
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

      {/* Historical Trends Chart */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Historical Market Trends (2019-2025)
            </CardTitle>
            <Tabs value={trendView} onValueChange={(v) => setTrendView(v as 'yearly' | 'monthly')}>
              <TabsList className="bg-secondary/30">
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {trendView === 'yearly' ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearlyTrendData}>
                  <defs>
                    <linearGradient id="colorFoodBev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTech2" x1="0" y1="0" x2="0" y2="1">
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
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Food & Beverage"
                    stroke="hsl(var(--chart-1))"
                    fillOpacity={1}
                    fill="url(#colorFoodBev2)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Technology"
                    stroke="hsl(var(--chart-2))"
                    fillOpacity={1}
                    fill="url(#colorTech2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData.filter((d) => d.sector === 'Technology')}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `${value}%`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="growth"
                    name="Growth Rate %"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5-Year Projection Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            5-Year Revenue & Profit Projection
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
                <Legend />
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
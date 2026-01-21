import { useState } from 'react';
import { IndianRupee, TrendingUp, TrendingDown, Calendar, Info, ChevronUp } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ProfitLossTabProps {
  analysis: BusinessAnalysis | null;
}

type ViewLevel = 'yearly' | 'monthly' | 'daily';

export function ProfitLossTab({ analysis }: ProfitLossTabProps) {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('yearly');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string>('');

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <TrendingDown className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground max-w-md">
          Submit a business idea in the Chat tab to see profit & loss projections.
        </p>
      </div>
    );
  }

  const { financialProjection } = analysis;

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  const handleYearClick = (year: number) => {
    setSelectedYear(year);
    setViewLevel('monthly');
    const yearData = financialProjection.yearlyData.find((y) => y.year === year);
    setExplanation(
      `Year ${year}: Projected revenue of ${formatCurrency(yearData?.revenue || 0)} with expenses of ${formatCurrency(yearData?.expenses || 0)}, resulting in ${(yearData?.profit || 0) >= 0 ? 'profit' : 'loss'} of ${formatCurrency(Math.abs(yearData?.profit || 0))}. Click on any month to see detailed daily breakdown.`
    );
  };

  const handleMonthClick = (month: string) => {
    setSelectedMonth(month);
    setViewLevel('daily');
    const yearData = financialProjection.yearlyData.find((y) => y.year === selectedYear);
    const monthData = yearData?.months?.find((m) => m.month === month);
    setExplanation(
      `${month} ${selectedYear}: This month shows ${formatCurrency(monthData?.revenue || 0)} in revenue. ${month === 'Nov' || month === 'Dec' ? 'Festive season typically drives 20-30% higher sales.' : month === 'Jan' || month === 'Feb' ? 'Post-holiday slowdown is common.' : 'Regular business period with steady demand.'}`
    );
  };

  const handleBackClick = () => {
    if (viewLevel === 'daily') {
      setViewLevel('monthly');
      setSelectedMonth(null);
    } else if (viewLevel === 'monthly') {
      setViewLevel('yearly');
      setSelectedYear(null);
    }
    setExplanation('');
  };

  const getChartData = () => {
    if (viewLevel === 'yearly') {
      return financialProjection.yearlyData.map((y) => ({
        name: y.year.toString(),
        Revenue: y.revenue,
        Expenses: y.expenses,
        Profit: y.profit,
      }));
    }

    if (viewLevel === 'monthly' && selectedYear) {
      const yearData = financialProjection.yearlyData.find((y) => y.year === selectedYear);
      return (
        yearData?.months?.map((m) => ({
          name: m.month,
          Revenue: m.revenue,
          Expenses: m.expenses,
          Profit: m.profit,
        })) || []
      );
    }

    // Generate sample daily data for selected month
    if (viewLevel === 'daily' && selectedMonth && selectedYear) {
      const yearData = financialProjection.yearlyData.find((y) => y.year === selectedYear);
      const monthData = yearData?.months?.find((m) => m.month === selectedMonth);
      const dailyRevenue = (monthData?.revenue || 0) / 30;
      const dailyExpenses = (monthData?.expenses || 0) / 30;

      return Array.from({ length: 30 }, (_, i) => {
        const variance = 0.7 + Math.random() * 0.6;
        const weekendBoost = (i % 7 === 5 || i % 7 === 6) ? 1.3 : 1;
        return {
          name: (i + 1).toString(),
          Revenue: Math.round(dailyRevenue * variance * weekendBoost),
          Expenses: Math.round(dailyExpenses * variance),
          Profit: Math.round((dailyRevenue * variance * weekendBoost) - (dailyExpenses * variance)),
        };
      });
    }

    return [];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Break-even</p>
            <p className="text-2xl font-bold">{financialProjection.breakEvenMonths} months</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">5-Year ROI</p>
            <p className={cn('text-2xl font-bold', financialProjection.roi >= 0 ? 'text-go' : 'text-avoid')}>
              {financialProjection.roi}%
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Year 1 Revenue</p>
            <p className="text-2xl font-bold">{formatCurrency(financialProjection.yearlyData[0]?.revenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Year 5 Profit</p>
            <p className={cn('text-2xl font-bold', (financialProjection.yearlyData[4]?.profit || 0) >= 0 ? 'text-go' : 'text-avoid')}>
              {formatCurrency(financialProjection.yearlyData[4]?.profit || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">View:</span>
          <div className="flex gap-1">
            <Button
              variant={viewLevel === 'yearly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewLevel('yearly');
                setSelectedYear(null);
                setSelectedMonth(null);
                setExplanation('');
              }}
            >
              Yearly
            </Button>
            <Button
              variant={viewLevel === 'monthly' ? 'default' : 'outline'}
              size="sm"
              disabled={!selectedYear}
              onClick={() => setViewLevel('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={viewLevel === 'daily' ? 'default' : 'outline'}
              size="sm"
              disabled={!selectedMonth}
              onClick={() => setViewLevel('daily')}
            >
              Daily
            </Button>
          </div>
        </div>
        {viewLevel !== 'yearly' && (
          <Button variant="ghost" size="sm" onClick={handleBackClick} className="gap-1">
            <ChevronUp className="w-4 h-4" /> Back
          </Button>
        )}
      </div>

      {/* Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {viewLevel === 'yearly' && '5-Year Financial Projection'}
            {viewLevel === 'monthly' && `${selectedYear} Monthly Breakdown`}
            {viewLevel === 'daily' && `${selectedMonth} ${selectedYear} Daily View`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={getChartData()} 
                onClick={(data) => {
                  if (data?.activePayload?.[0]?.payload) {
                    const name = data.activePayload[0].payload.name;
                    if (viewLevel === 'yearly') {
                      handleYearClick(parseInt(name));
                    } else if (viewLevel === 'monthly') {
                      handleMonthClick(name);
                    }
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
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
                <Bar dataKey="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="Expenses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} cursor="pointer" />
                <Bar dataKey="Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {viewLevel !== 'yearly' && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Click on a {viewLevel === 'monthly' ? 'month' : 'day'} to see more details
            </p>
          )}

          {viewLevel === 'yearly' && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Click on a year to drill down into monthly data
            </p>
          )}
        </CardContent>
      </Card>

      {/* Explanation Panel */}
      {explanation && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 fade-in">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">{explanation}</p>
          </div>
        </div>
      )}

      {/* Expert Analysis */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Financial Expert Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{financialProjection.explanation}</p>
        </CardContent>
      </Card>
    </div>
  );
}

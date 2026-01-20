import { useState } from 'react';
import { Users, Shield, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface CompetitionTabProps {
  analysis: BusinessAnalysis | null;
}

export function CompetitionTab({ analysis }: CompetitionTabProps) {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground max-w-md">
          Submit a business idea in the Chat tab to see competition analysis.
        </p>
      </div>
    );
  }

  const { competitionAnalysis } = analysis;
  const totalCompetitors = competitionAnalysis.directCompetitors + competitionAnalysis.indirectCompetitors;

  const pieData = [
    { name: 'Direct Competitors', value: competitionAnalysis.directCompetitors, color: 'hsl(var(--chart-5))' },
    { name: 'Indirect Competitors', value: competitionAnalysis.indirectCompetitors, color: 'hsl(var(--chart-3))' },
    { name: 'Your Market Share (Potential)', value: Math.round(totalCompetitors * 0.1) || 1, color: 'hsl(var(--chart-2))' },
  ];

  const handlePieClick = (data: { name: string }) => {
    setSelectedSegment(data.name);
  };

  const getSegmentExplanation = (segment: string) => {
    switch (segment) {
      case 'Direct Competitors':
        return `These ${competitionAnalysis.directCompetitors} businesses offer the same or very similar products/services in your target area. They compete for the exact same customer base. Focus on differentiation through quality, price, or unique features.`;
      case 'Indirect Competitors':
        return `These ${competitionAnalysis.indirectCompetitors} businesses serve the same customer needs but with different solutions. For example, a cloud kitchen competes indirectly with home cooking, packed lunches, and food delivery apps.`;
      case 'Your Market Share (Potential)':
        return `Based on competitive density and market size, there's room for a new entrant. Your competitive advantage: "${competitionAnalysis.competitiveAdvantage}" can help capture this market share within the first 2 years.`;
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={handlePieClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        stroke={selectedSegment === entry.name ? 'white' : 'transparent'}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {selectedSegment && (
              <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border/50 fade-in">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium mb-1">{selectedSegment}</p>
                    <p className="text-sm text-muted-foreground">{getSegmentExplanation(selectedSegment)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competitive Advantage */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-go" />
              Your Competitive Edge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-go/10 border border-go/30 mb-4">
              <p className="text-lg font-medium">{competitionAnalysis.competitiveAdvantage}</p>
            </div>
            <p className="text-sm text-muted-foreground">{competitionAnalysis.explanation}</p>
          </CardContent>
        </Card>
      </div>

      {/* Threats & Opportunities */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-avoid" />
              Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {competitionAnalysis.threats.map((threat, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-avoid/10 border border-avoid/20">
                  <span className="w-6 h-6 rounded-full bg-avoid/20 flex items-center justify-center text-xs font-medium shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm">{threat}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-go" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {competitionAnalysis.opportunities.map((opportunity, index) => (
                <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-go/10 border border-go/20">
                  <span className="w-6 h-6 rounded-full bg-go/20 flex items-center justify-center text-xs font-medium shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm">{opportunity}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

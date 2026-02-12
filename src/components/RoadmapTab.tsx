import { useState } from 'react';
import { Map, Clock, CheckCircle2, Target, AlertTriangle, Info } from 'lucide-react';
import { BusinessAnalysis, Risk } from '@/types/analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RoadmapTabProps {
  analysis: BusinessAnalysis | null;
}

export function RoadmapTab({ analysis }: RoadmapTabProps) {
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Map className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground max-w-md">
          Submit a business idea in the Chat tab to see the implementation roadmap.
        </p>
      </div>);

  }

  const { roadmap, risks, recommendations } = analysis;

  const getSeverityColor = (severity: Risk['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-avoid/20 text-avoid border-avoid/30';
      case 'medium':
        return 'bg-caution/20 text-caution border-caution/30';
      case 'low':
        return 'bg-go/20 text-go border-go/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Phases Timeline */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            Implementation Roadmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

            <div className="space-y-6">
              {roadmap.phases.map((phase, index) =>
              <div
                key={index}
                className={cn(
                  'relative pl-14 cursor-pointer transition-all',
                  selectedPhase === index ? 'opacity-100' : 'opacity-70 hover:opacity-90'
                )}
                onClick={() => setSelectedPhase(selectedPhase === index ? null : index)}>

                  {/* Timeline dot */}
                  <div
                  className={cn(
                    'absolute left-4 top-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all',
                    selectedPhase === index ?
                    'bg-primary border-primary text-primary-foreground scale-110' :
                    'bg-background border-border'
                  )}>

                    {index + 1}
                  </div>

                  <div className={cn(
                  'p-4 rounded-lg border transition-all',
                  selectedPhase === index ? 'bg-primary/10 border-primary/30' : 'bg-secondary/30 border-border/50'
                )}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{phase.phase}</h4>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="w-3 h-3" />
                        {phase.duration}
                      </Badge>
                    </div>

                    {selectedPhase === index &&
                  <div className="mt-4 space-y-4 fade-in">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Tasks:</p>
                          <ul className="space-y-2">
                            {phase.tasks.map((task, i) =>
                        <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                {task}
                              </li>
                        )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Milestones:</p>
                          <ul className="space-y-2">
                            {phase.milestones.map((milestone, i) =>
                        <li key={i} className="flex items-start gap-2 text-sm">
                                <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                {milestone}
                              </li>
                        )}
                          </ul>
                        </div>
                      </div>
                  }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Roadmap explanation */}
          <div className="mt-6 p-4 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-secondary-foreground">{roadmap.explanation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risks & Recommendations */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Risks */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-caution" />
              Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {risks.map((risk, index) =>
              <div key={index} className="p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{risk.risk}</p>
                    <Badge className={getSeverityColor(risk.severity)}>
                      {risk.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-primary">
                    <span className="font-medium">Mitigation:</span> {risk.mitigation}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-go" />
              Expert Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recommendations.map((rec, index) =>
              <li key={index} className="flex items-start gap-3 p-3 rounded-lg bg-go/10 border border-go/20">
                  <span className="w-6 h-6 rounded-full bg-go/20 flex items-center justify-center text-xs font-medium shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm">{rec}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>);

}
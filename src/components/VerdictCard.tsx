import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { BusinessAnalysis } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface VerdictCardProps {
  analysis: BusinessAnalysis;
  compact?: boolean;
}

export function VerdictCard({ analysis, compact = false }: VerdictCardProps) {
  const verdictConfig = {
    GO: {
      icon: CheckCircle2,
      label: 'GO - High Potential',
      className: 'verdict-go',
      iconColor: 'text-go',
      bgClass: 'bg-go/20',
    },
    CAUTION: {
      icon: AlertTriangle,
      label: 'CAUTION - Moderate Risk',
      className: 'verdict-caution',
      iconColor: 'text-caution',
      bgClass: 'bg-caution/20',
    },
    AVOID: {
      icon: XCircle,
      label: 'AVOID - High Risk',
      className: 'verdict-avoid',
      iconColor: 'text-avoid',
      bgClass: 'bg-avoid/20',
    },
  };

  const config = verdictConfig[analysis.verdict];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full', config.bgClass)}>
        <Icon className={cn('w-4 h-4', config.iconColor)} />
        <span className="text-sm font-medium">{analysis.verdict}</span>
        <span className="text-sm text-muted-foreground">({analysis.score}/100)</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl p-5', config.className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.bgClass)}>
            <Icon className={cn('w-6 h-6', config.iconColor)} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{config.label}</h3>
            <p className="text-sm text-muted-foreground">Feasibility Score</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{analysis.score}</div>
          <div className="text-sm text-muted-foreground">/ 100</div>
        </div>
      </div>

      {/* Score Progress Bar */}
      <div className="h-2 bg-secondary/50 rounded-full overflow-hidden mb-4">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', {
            'bg-go': analysis.verdict === 'GO',
            'bg-caution': analysis.verdict === 'CAUTION',
            'bg-avoid': analysis.verdict === 'AVOID',
          })}
          style={{ width: `${analysis.score}%` }}
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-background/30">
          <p className="text-xs text-muted-foreground mb-1">ROI</p>
          <p className="text-lg font-semibold flex items-center justify-center gap-1">
            {analysis.financialProjection.roi > 0 ? (
              <TrendingUp className="w-4 h-4 text-go" />
            ) : (
              <TrendingDown className="w-4 h-4 text-avoid" />
            )}
            {analysis.financialProjection.roi}%
          </p>
        </div>
        <div className="text-center p-3 rounded-lg bg-background/30">
          <p className="text-xs text-muted-foreground mb-1">Break-even</p>
          <p className="text-lg font-semibold">{analysis.financialProjection.breakEvenMonths}mo</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-background/30">
          <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
          <p className="text-lg font-semibold">
            {analysis.risks.filter((r) => r.severity === 'high').length} High
          </p>
        </div>
      </div>
    </div>
  );
}

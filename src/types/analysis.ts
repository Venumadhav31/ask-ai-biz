export interface MonthData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface YearData {
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  months?: MonthData[];
}

export interface MarketAnalysis {
  size: string;
  growth: string;
  competition: string;
  explanation: string;
}

export interface FinancialProjection {
  yearlyData: YearData[];
  breakEvenMonths: number;
  roi: number;
  explanation: string;
}

export interface CompetitionAnalysis {
  directCompetitors: number;
  indirectCompetitors: number;
  competitiveAdvantage: string;
  threats: string[];
  opportunities: string[];
  explanation: string;
}

export interface RoadmapPhase {
  phase: string;
  duration: string;
  tasks: string[];
  milestones: string[];
}

export interface Roadmap {
  phases: RoadmapPhase[];
  explanation: string;
}

export interface Risk {
  risk: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface BusinessAnalysis {
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  score: number;
  summary: string;
  marketAnalysis: MarketAnalysis;
  financialProjection: FinancialProjection;
  competitionAnalysis: CompetitionAnalysis;
  roadmap: Roadmap;
  risks: Risk[];
  recommendations: string[];
  expertInsights: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  analysis?: BusinessAnalysis;
  timestamp: Date;
}

export interface TestScenario {
  id: string;
  name: string;
  businessIdea: string;
  location: string;
  budget: string;
  expectedVerdict: 'GO' | 'CAUTION' | 'AVOID';
  category: string;
}

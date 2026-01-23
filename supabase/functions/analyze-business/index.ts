/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  businessIdea: string;
  location: string;
  budget: string;
}

// ============================================
// DECISION ENGINE (JavaScript-based scoring)
// AI is NOT used for decision-making
// ============================================

interface ScoringFactors {
  marketSize: number;
  competition: number;
  budgetFit: number;
  locationViability: number;
  industryGrowth: number;
  riskLevel: number;
}

interface DecisionResult {
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  score: number;
  factors: ScoringFactors;
  breakEvenMonths: number;
  roi: number;
  directCompetitors: number;
  indirectCompetitors: number;
}

function parseBusinessType(idea: string): string {
  const lowerIdea = idea.toLowerCase();
  if (lowerIdea.includes('restaurant') || lowerIdea.includes('food') || lowerIdea.includes('kitchen') || lowerIdea.includes('cafe')) return 'food';
  if (lowerIdea.includes('tech') || lowerIdea.includes('software') || lowerIdea.includes('app') || lowerIdea.includes('saas')) return 'tech';
  if (lowerIdea.includes('retail') || lowerIdea.includes('shop') || lowerIdea.includes('store')) return 'retail';
  if (lowerIdea.includes('service') || lowerIdea.includes('consulting') || lowerIdea.includes('agency')) return 'service';
  if (lowerIdea.includes('health') || lowerIdea.includes('fitness') || lowerIdea.includes('gym')) return 'health';
  if (lowerIdea.includes('education') || lowerIdea.includes('training') || lowerIdea.includes('coaching')) return 'education';
  return 'general';
}

function parseBudget(budget: string): number {
  const cleanBudget = budget.replace(/[₹$,\s]/g, '').toLowerCase();
  let multiplier = 1;
  if (cleanBudget.includes('lakh') || cleanBudget.includes('lac')) multiplier = 100000;
  else if (cleanBudget.includes('cr') || cleanBudget.includes('crore')) multiplier = 10000000;
  else if (cleanBudget.includes('k')) multiplier = 1000;
  else if (cleanBudget.includes('m')) multiplier = 1000000;
  const numMatch = cleanBudget.match(/[\d.]+/);
  return numMatch ? parseFloat(numMatch[0]) * multiplier : 500000;
}

function getLocationTier(location: string): number {
  const tier1 = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'hyderabad', 'kolkata', 'pune'];
  const tier2 = ['ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'indore', 'bhopal', 'nagpur', 'surat'];
  const lowerLoc = location.toLowerCase();
  if (tier1.some(city => lowerLoc.includes(city))) return 1;
  if (tier2.some(city => lowerLoc.includes(city))) return 2;
  return 3;
}

function calculateDecision(businessIdea: string, location: string, budget: string): DecisionResult {
  const businessType = parseBusinessType(businessIdea);
  const budgetAmount = parseBudget(budget);
  const locationTier = getLocationTier(location);

  // Industry benchmarks for scoring
  const industryBenchmarks: Record<string, { minBudget: number; margin: number; growth: number; competition: number }> = {
    food: { minBudget: 500000, margin: 0.18, growth: 12, competition: 0.7 },
    tech: { minBudget: 300000, margin: 0.35, growth: 25, competition: 0.5 },
    retail: { minBudget: 800000, margin: 0.12, growth: 8, competition: 0.8 },
    service: { minBudget: 200000, margin: 0.40, growth: 15, competition: 0.4 },
    health: { minBudget: 1000000, margin: 0.25, growth: 18, competition: 0.5 },
    education: { minBudget: 400000, margin: 0.30, growth: 20, competition: 0.45 },
    general: { minBudget: 500000, margin: 0.20, growth: 10, competition: 0.6 },
  };

  const benchmark = industryBenchmarks[businessType];

  // Calculate scoring factors (0-100 scale)
  const budgetFit = Math.min(100, (budgetAmount / benchmark.minBudget) * 70);
  const marketSize = locationTier === 1 ? 85 : locationTier === 2 ? 65 : 45;
  const competition = Math.round((1 - benchmark.competition) * 100);
  const industryGrowth = Math.min(100, benchmark.growth * 4);
  const locationViability = locationTier === 1 ? 90 : locationTier === 2 ? 70 : 50;
  
  // Risk calculation based on multiple factors
  const riskFactors = [
    budgetAmount < benchmark.minBudget ? 25 : 0,
    benchmark.competition > 0.6 ? 20 : 0,
    locationTier === 3 ? 15 : 0,
    benchmark.growth < 10 ? 10 : 0,
  ];
  const riskLevel = 100 - riskFactors.reduce((a, b) => a + b, 0);

  const factors: ScoringFactors = {
    marketSize,
    competition,
    budgetFit: Math.round(budgetFit),
    locationViability,
    industryGrowth,
    riskLevel,
  };

  // Weighted score calculation
  const weights = {
    marketSize: 0.20,
    competition: 0.15,
    budgetFit: 0.25,
    locationViability: 0.15,
    industryGrowth: 0.15,
    riskLevel: 0.10,
  };

  const score = Math.round(
    factors.marketSize * weights.marketSize +
    factors.competition * weights.competition +
    factors.budgetFit * weights.budgetFit +
    factors.locationViability * weights.locationViability +
    factors.industryGrowth * weights.industryGrowth +
    factors.riskLevel * weights.riskLevel
  );

  // Verdict determination (rule-based, not AI)
  let verdict: 'GO' | 'CAUTION' | 'AVOID';
  if (score >= 70 && factors.riskLevel >= 60) {
    verdict = 'GO';
  } else if (score >= 45 || (score >= 35 && factors.industryGrowth >= 70)) {
    verdict = 'CAUTION';
  } else {
    verdict = 'AVOID';
  }

  // Financial calculations
  const monthlyRevenue = budgetAmount * benchmark.margin * 0.15;
  const monthlyExpenses = budgetAmount * 0.08;
  const monthlyProfit = monthlyRevenue - monthlyExpenses;
  const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(budgetAmount / monthlyProfit) : 36;
  const roi = Math.round(((monthlyProfit * 12) / budgetAmount) * 100);

  // Competitor estimation
  const baseCompetitors = locationTier === 1 ? 25 : locationTier === 2 ? 15 : 8;
  const directCompetitors = Math.round(baseCompetitors * benchmark.competition);
  const indirectCompetitors = Math.round(directCompetitors * 1.5);

  return {
    verdict,
    score,
    factors,
    breakEvenMonths: Math.min(breakEvenMonths, 36),
    roi,
    directCompetitors,
    indirectCompetitors,
  };
}

function generateFinancialProjections(budget: string, decision: DecisionResult) {
  const budgetAmount = parseBudget(budget);
  const years = [2025, 2026, 2027, 2028, 2029];
  const growthRates = [1, 1.25, 1.45, 1.6, 1.75];

  return years.map((year, idx) => {
    const baseRevenue = budgetAmount * 0.8 * growthRates[idx];
    const baseExpenses = budgetAmount * 0.5 * (1 + idx * 0.08);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const monthlyData = months.map((month, mIdx) => {
      const seasonality = 1 + Math.sin((mIdx - 2) * Math.PI / 6) * 0.15;
      const revenue = Math.round((baseRevenue / 12) * seasonality);
      const expenses = Math.round(baseExpenses / 12);
      return { month, revenue, expenses, profit: revenue - expenses };
    });

    return {
      year,
      revenue: Math.round(baseRevenue),
      expenses: Math.round(baseExpenses),
      profit: Math.round(baseRevenue - baseExpenses),
      months: monthlyData,
    };
  });
}

// ============================================
// AI REASONING ENGINE (for insights only)
// ============================================

async function getAIReasoning(
  businessIdea: string,
  location: string,
  budget: string,
  decision: DecisionResult
): Promise<{ marketExplanation: string; competitionExplanation: string; financialExplanation: string; roadmapExplanation: string; expertInsights: string; threats: string[]; opportunities: string[]; risks: { risk: string; severity: 'low' | 'medium' | 'high'; mitigation: string }[]; recommendations: string[]; roadmapPhases: { phase: string; duration: string; tasks: string[]; milestones: string[] }[]; competitiveAdvantage: string; marketSize: string; marketGrowth: string; }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const systemPrompt = `You are an expert business analyst providing REASONING and INSIGHTS only. You do NOT make decisions - the verdict and scores are already determined by our scoring engine.

Your role:
- Explain WHY the market conditions are what they are
- Provide LOCAL context for ${location}
- Give actionable recommendations
- Identify specific threats and opportunities
- Create a realistic implementation roadmap

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
  "marketSize": "Brief market size description",
  "marketGrowth": "Growth rate description",
  "marketExplanation": "2-3 sentences explaining local market conditions",
  "competitiveAdvantage": "Key differentiator for this business",
  "threats": ["threat1", "threat2", "threat3"],
  "opportunities": ["opp1", "opp2", "opp3"],
  "competitionExplanation": "2-3 sentences on competitive landscape",
  "financialExplanation": "2-3 sentences on financial outlook",
  "roadmapPhases": [
    {"phase": "Phase 1: Setup", "duration": "2 months", "tasks": ["task1", "task2"], "milestones": ["milestone1"]},
    {"phase": "Phase 2: Launch", "duration": "3 months", "tasks": ["task1", "task2"], "milestones": ["milestone1"]},
    {"phase": "Phase 3: Growth", "duration": "6 months", "tasks": ["task1", "task2"], "milestones": ["milestone1"]}
  ],
  "roadmapExplanation": "Why this roadmap makes sense",
  "risks": [
    {"risk": "risk description", "severity": "low|medium|high", "mitigation": "how to handle"},
    {"risk": "risk description", "severity": "low|medium|high", "mitigation": "how to handle"}
  ],
  "recommendations": ["actionable rec 1", "actionable rec 2", "actionable rec 3"],
  "expertInsights": "2-3 paragraphs of expert analysis with specific local insights for ${location}"
}`;

  const userPrompt = `Provide reasoning and insights for this business analysis:

Business Idea: ${businessIdea}
Location: ${location || 'Major Indian city'}
Budget: ${budget || 'Not specified'}

DECISION ENGINE RESULTS (already calculated, do not change):
- Verdict: ${decision.verdict}
- Score: ${decision.score}/100
- Break-even: ${decision.breakEvenMonths} months
- ROI: ${decision.roi}%
- Direct Competitors: ${decision.directCompetitors}
- Indirect Competitors: ${decision.indirectCompetitors}

Provide your expert REASONING to explain these numbers and give actionable insights. Focus on ${location} specific details.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from AI');
  }

  let jsonContent = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1].trim();
  }

  return JSON.parse(jsonContent);
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { businessIdea, location, budget }: AnalysisRequest = await req.json();

    if (!businessIdea) {
      return new Response(
        JSON.stringify({ error: 'Business idea is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing: ${businessIdea} in ${location} with budget ${budget}`);

    // Step 1: Decision Engine (JavaScript) - Scoring & Verdict
    console.log('Running decision engine...');
    const decision = calculateDecision(businessIdea, location, budget);
    console.log(`Decision: ${decision.verdict} (${decision.score}/100)`);

    // Step 2: Generate Financial Projections (JavaScript)
    const yearlyData = generateFinancialProjections(budget, decision);

    // Step 3: AI Reasoning (for explanations only)
    console.log('Getting AI reasoning...');
    const reasoning = await getAIReasoning(businessIdea, location, budget, decision);

    // Combine decision + reasoning into final response
    const analysis = {
      // From Decision Engine (JavaScript)
      verdict: decision.verdict,
      score: decision.score,
      
      // Summary combining both
      summary: `Based on our analysis, this ${decision.verdict === 'GO' ? 'is a viable opportunity' : decision.verdict === 'CAUTION' ? 'requires careful consideration' : 'faces significant challenges'}. Score: ${decision.score}/100 with ${decision.breakEvenMonths}-month break-even timeline.`,
      
      marketAnalysis: {
        size: reasoning.marketSize,
        growth: reasoning.marketGrowth,
        competition: decision.factors.competition > 60 ? 'Low' : decision.factors.competition > 40 ? 'Moderate' : 'High',
        explanation: reasoning.marketExplanation,
      },
      
      financialProjection: {
        yearlyData,
        breakEvenMonths: decision.breakEvenMonths,
        roi: decision.roi,
        explanation: reasoning.financialExplanation,
      },
      
      competitionAnalysis: {
        directCompetitors: decision.directCompetitors,
        indirectCompetitors: decision.indirectCompetitors,
        competitiveAdvantage: reasoning.competitiveAdvantage,
        threats: reasoning.threats,
        opportunities: reasoning.opportunities,
        explanation: reasoning.competitionExplanation,
      },
      
      roadmap: {
        phases: reasoning.roadmapPhases,
        explanation: reasoning.roadmapExplanation,
      },
      
      risks: reasoning.risks,
      recommendations: reasoning.recommendations,
      expertInsights: reasoning.expertInsights,
    };

    console.log(`Analysis complete: ${analysis.verdict} (${analysis.score}/100)`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Please try again with more details about your business idea.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

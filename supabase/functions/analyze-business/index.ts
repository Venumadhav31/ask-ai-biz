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
  
  // Street food & quick service
  if (lowerIdea.includes('panipuri') || lowerIdea.includes('pani puri') || lowerIdea.includes('chaat') || 
      lowerIdea.includes('samosa') || lowerIdea.includes('vada pav') || lowerIdea.includes('momos') ||
      lowerIdea.includes('street food') || lowerIdea.includes('stall') || lowerIdea.includes('cart')) return 'streetfood';
  
  // Bakery
  if (lowerIdea.includes('bakery') || lowerIdea.includes('cake') || lowerIdea.includes('pastry') || 
      lowerIdea.includes('bread') || lowerIdea.includes('confectionery')) return 'bakery';
  
  // Restaurant & food service
  if (lowerIdea.includes('restaurant') || lowerIdea.includes('food') || lowerIdea.includes('kitchen') || 
      lowerIdea.includes('cafe') || lowerIdea.includes('coffee') || lowerIdea.includes('tea') ||
      lowerIdea.includes('tiffin') || lowerIdea.includes('mess') || lowerIdea.includes('dhaba')) return 'food';
  
  // Tech
  if (lowerIdea.includes('tech') || lowerIdea.includes('software') || lowerIdea.includes('app') || 
      lowerIdea.includes('saas') || lowerIdea.includes('it ') || lowerIdea.includes('digital')) return 'tech';
  
  // Retail
  if (lowerIdea.includes('retail') || lowerIdea.includes('shop') || lowerIdea.includes('store') ||
      lowerIdea.includes('kirana') || lowerIdea.includes('grocery') || lowerIdea.includes('supermarket')) return 'retail';
  
  // Service
  if (lowerIdea.includes('service') || lowerIdea.includes('consulting') || lowerIdea.includes('agency') ||
      lowerIdea.includes('salon') || lowerIdea.includes('parlour') || lowerIdea.includes('laundry')) return 'service';
  
  // Health & fitness
  if (lowerIdea.includes('health') || lowerIdea.includes('fitness') || lowerIdea.includes('gym') ||
      lowerIdea.includes('yoga') || lowerIdea.includes('clinic') || lowerIdea.includes('pharmacy')) return 'health';
  
  // Education
  if (lowerIdea.includes('education') || lowerIdea.includes('training') || lowerIdea.includes('coaching') ||
      lowerIdea.includes('tuition') || lowerIdea.includes('school') || lowerIdea.includes('academy')) return 'education';
  
  // Agriculture & farming
  if (lowerIdea.includes('farm') || lowerIdea.includes('agri') || lowerIdea.includes('dairy') ||
      lowerIdea.includes('poultry') || lowerIdea.includes('organic') || lowerIdea.includes('nursery')) return 'agriculture';
  
  // Manufacturing
  if (lowerIdea.includes('manufacturing') || lowerIdea.includes('factory') || lowerIdea.includes('production') ||
      lowerIdea.includes('unit') || lowerIdea.includes('industry')) return 'manufacturing';
  
  return 'general';
}

function parseBudget(budget: string): number {
  const cleanBudget = budget.replace(/[₹$,\s]/g, '').toLowerCase();
  let multiplier = 1;
  
  // Handle various Indian budget formats
  if (cleanBudget.includes('lakh') || cleanBudget.includes('lac') || cleanBudget.includes('lakhs')) {
    multiplier = 100000;
  } else if (cleanBudget.includes('cr') || cleanBudget.includes('crore')) {
    multiplier = 10000000;
  } else if (cleanBudget.endsWith('l') && !cleanBudget.includes('lakh')) {
    // Handle "5l", "10l" format (common shorthand for lakhs)
    multiplier = 100000;
  } else if (cleanBudget.includes('k')) {
    multiplier = 1000;
  } else if (cleanBudget.includes('m') && !cleanBudget.includes('lakh')) {
    multiplier = 1000000;
  }
  
  const numMatch = cleanBudget.match(/[\d.]+/);
  const amount = numMatch ? parseFloat(numMatch[0]) * multiplier : 500000;
  
  console.log(`Budget parsed: "${budget}" -> ${amount}`);
  return amount;
}

function getLocationTier(location: string): number {
  const tier1 = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'hyderabad', 'kolkata', 'pune', 'gurgaon', 'noida'];
  const tier2 = ['ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'indore', 'bhopal', 'nagpur', 'surat', 'kochi', 'coimbatore', 'visakhapatnam', 'patna', 'vadodara', 'thiruvananthapuram'];
  const tier3 = ['tirupati', 'vijayawada', 'guntur', 'nellore', 'kurnool', 'kakinada', 'rajahmundry', 'kadapa', 'anantapur', 'eluru', 'ongole', 'vizianagaram', 'proddatur', 'chittoor', 'hindupur', 'machilipatnam', 'tenali', 'adoni', 'madanapalle', 'srikakulam', 'dharmavaram', 'gudivada', 'narasaraopet', 'tadipatri', 'mangalore', 'mysore', 'hubli', 'belgaum'];
  
  const lowerLoc = location.toLowerCase();
  if (tier1.some(city => lowerLoc.includes(city))) return 1;
  if (tier2.some(city => lowerLoc.includes(city))) return 2;
  if (tier3.some(city => lowerLoc.includes(city))) return 3;
  
  // Default to tier 3 for unknown locations (small towns)
  console.log(`Location tier for "${location}": 3 (default)`);
  return 3;
}

function calculateDecision(businessIdea: string, location: string, budget: string): DecisionResult {
  const businessType = parseBusinessType(businessIdea);
  const budgetAmount = parseBudget(budget);
  const locationTier = getLocationTier(location);

  console.log(`Business type: ${businessType}, Budget: ₹${budgetAmount}, Location tier: ${locationTier}`);

  // Industry benchmarks - expanded with more business types
  const industryBenchmarks: Record<string, { minBudget: number; margin: number; growth: number; competition: number; tierBonus: number[] }> = {
    streetfood: { minBudget: 50000, margin: 0.35, growth: 18, competition: 0.4, tierBonus: [0, 5, 15] }, // Low capital, high margin, great for small towns
    bakery: { minBudget: 200000, margin: 0.28, growth: 14, competition: 0.5, tierBonus: [0, 8, 12] },
    food: { minBudget: 500000, margin: 0.18, growth: 12, competition: 0.7, tierBonus: [0, 5, 8] },
    tech: { minBudget: 300000, margin: 0.35, growth: 25, competition: 0.5, tierBonus: [10, 0, -10] }, // Better in big cities
    retail: { minBudget: 300000, margin: 0.15, growth: 10, competition: 0.6, tierBonus: [0, 5, 10] },
    service: { minBudget: 100000, margin: 0.45, growth: 16, competition: 0.35, tierBonus: [0, 8, 12] },
    health: { minBudget: 800000, margin: 0.25, growth: 18, competition: 0.5, tierBonus: [5, 10, 5] },
    education: { minBudget: 200000, margin: 0.35, growth: 22, competition: 0.4, tierBonus: [0, 10, 15] }, // Great for tier 2/3
    agriculture: { minBudget: 300000, margin: 0.22, growth: 15, competition: 0.3, tierBonus: [-5, 10, 20] }, // Best for rural
    manufacturing: { minBudget: 1000000, margin: 0.18, growth: 12, competition: 0.5, tierBonus: [-5, 5, 15] },
    general: { minBudget: 300000, margin: 0.20, growth: 12, competition: 0.5, tierBonus: [0, 5, 8] },
  };

  const benchmark = industryBenchmarks[businessType] || industryBenchmarks.general;
  const tierBonusIndex = locationTier - 1;
  const tierBonus = benchmark.tierBonus[tierBonusIndex] || 0;

  // Calculate scoring factors (0-100 scale) with tier-specific adjustments
  const budgetRatio = budgetAmount / benchmark.minBudget;
  let budgetFit: number;
  if (budgetRatio >= 2) {
    budgetFit = 95; // Well capitalized
  } else if (budgetRatio >= 1.5) {
    budgetFit = 85;
  } else if (budgetRatio >= 1) {
    budgetFit = 75;
  } else if (budgetRatio >= 0.7) {
    budgetFit = 60;
  } else if (budgetRatio >= 0.5) {
    budgetFit = 45;
  } else {
    budgetFit = 30;
  }

  // Market size varies by tier but some businesses do BETTER in smaller towns
  const baseMarketSize = locationTier === 1 ? 85 : locationTier === 2 ? 70 : 55;
  const marketSize = Math.min(100, baseMarketSize + tierBonus);

  // Competition is often LOWER in smaller towns
  const baseCompetition = Math.round((1 - benchmark.competition) * 100);
  const competitionBonus = locationTier === 3 ? 15 : locationTier === 2 ? 8 : 0;
  const competition = Math.min(100, baseCompetition + competitionBonus);

  const industryGrowth = Math.min(100, benchmark.growth * 4);
  
  // Location viability with tier bonus
  const baseLocationViability = locationTier === 1 ? 85 : locationTier === 2 ? 70 : 55;
  const locationViability = Math.min(100, baseLocationViability + tierBonus);
  
  // Risk calculation - more nuanced
  let riskScore = 100;
  if (budgetRatio < 0.5) riskScore -= 30;
  else if (budgetRatio < 0.7) riskScore -= 15;
  else if (budgetRatio < 1) riskScore -= 8;
  
  if (benchmark.competition > 0.6) riskScore -= 15;
  else if (benchmark.competition > 0.5) riskScore -= 8;
  
  // Small towns actually have LOWER risk for certain businesses
  if (locationTier === 3 && tierBonus > 0) riskScore += 5;
  else if (locationTier === 3) riskScore -= 10;
  
  if (benchmark.growth < 10) riskScore -= 10;
  
  const riskLevel = Math.max(20, riskScore);

  const factors: ScoringFactors = {
    marketSize,
    competition,
    budgetFit: Math.round(budgetFit),
    locationViability,
    industryGrowth,
    riskLevel,
  };

  console.log('Scoring factors:', JSON.stringify(factors));

  // Weighted score calculation
  const weights = {
    marketSize: 0.18,
    competition: 0.12,
    budgetFit: 0.28, // Budget fit is most important
    locationViability: 0.15,
    industryGrowth: 0.15,
    riskLevel: 0.12,
  };

  const score = Math.round(
    factors.marketSize * weights.marketSize +
    factors.competition * weights.competition +
    factors.budgetFit * weights.budgetFit +
    factors.locationViability * weights.locationViability +
    factors.industryGrowth * weights.industryGrowth +
    factors.riskLevel * weights.riskLevel
  );

  // Verdict determination (rule-based)
  let verdict: 'GO' | 'CAUTION' | 'AVOID';
  if (score >= 68 && factors.riskLevel >= 55 && factors.budgetFit >= 60) {
    verdict = 'GO';
  } else if (score >= 50 || (score >= 40 && factors.industryGrowth >= 60)) {
    verdict = 'CAUTION';
  } else {
    verdict = 'AVOID';
  }

  console.log(`Calculated score: ${score}, verdict: ${verdict}`);

  // Financial calculations based on business type
  const monthlyRevenue = (budgetAmount * benchmark.margin * 0.12) * (locationTier === 1 ? 1.2 : locationTier === 2 ? 1 : 0.85);
  const monthlyExpenses = budgetAmount * 0.06 * (locationTier === 1 ? 1.3 : locationTier === 2 ? 1 : 0.75);
  const monthlyProfit = monthlyRevenue - monthlyExpenses;
  const breakEvenMonths = monthlyProfit > 0 ? Math.ceil(budgetAmount * 0.7 / monthlyProfit) : 36;
  const roi = Math.round(((monthlyProfit * 12) / budgetAmount) * 100);

  // Competitor estimation - fewer in small towns
  const baseCompetitors = locationTier === 1 ? 30 : locationTier === 2 ? 18 : 6;
  const directCompetitors = Math.max(2, Math.round(baseCompetitors * benchmark.competition));
  const indirectCompetitors = Math.round(directCompetitors * 1.4);

  return {
    verdict,
    score,
    factors,
    breakEvenMonths: Math.min(Math.max(breakEvenMonths, 6), 36),
    roi: Math.max(roi, -20),
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

/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Dynamic CORS
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = ['https://lovable.dev', 'http://localhost:5173', 'http://localhost:3000'];
  const isLovablePreview = origin.includes('.lovable.app') || origin.includes('.lovableproject.com');
  const isAllowed = allowedOrigins.includes(origin) || isLovablePreview;
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// ============================================
// INPUT VALIDATION
// ============================================

interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: { businessIdea: string; location: string; budget: string };
}

function validateInput(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request body' };
  const { businessIdea, location, budget } = body as Record<string, unknown>;
  if (!businessIdea || typeof businessIdea !== 'string') return { valid: false, error: 'Business idea is required' };
  const trimmedIdea = businessIdea.trim();
  if (trimmedIdea.length < 10) return { valid: false, error: 'Business idea must be at least 10 characters' };
  if (trimmedIdea.length > 2000) return { valid: false, error: 'Business idea must be less than 2000 characters' };
  let trimmedLocation = '';
  if (location) {
    if (typeof location !== 'string') return { valid: false, error: 'Location must be a string' };
    trimmedLocation = location.trim();
    if (trimmedLocation.length > 200) return { valid: false, error: 'Location must be less than 200 characters' };
  }
  let trimmedBudget = '';
  if (budget) {
    if (typeof budget !== 'string') return { valid: false, error: 'Budget must be a string' };
    trimmedBudget = budget.trim();
    if (trimmedBudget.length > 100) return { valid: false, error: 'Budget must be less than 100 characters' };
  }
  return { valid: true, data: { businessIdea: trimmedIdea, location: trimmedLocation || 'Not specified', budget: trimmedBudget || 'Not specified' } };
}

// ============================================
// DETERMINISTIC DECISION ENGINE
// ============================================

interface ScoringFactors {
  budgetFit: number;        // 0-100
  locationViability: number; // 0-100
  businessComplexity: number;// 0-100
  marketPotential: number;   // 0-100
  scalability: number;       // 0-100
  riskLevel: number;         // 0-100 (higher = less risky)
}

interface DecisionResult {
  score: number;
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  scoringFactors: ScoringFactors;
  breakEvenMonths: number;
  roi: number;
  financialProjections: Array<{ year: number; revenue: number; expenses: number; profit: number }>;
  directCompetitors: number;
  indirectCompetitors: number;
  riskSeverities: Array<'low' | 'medium' | 'high'>;
}

// Parse budget to a numeric value in INR
function parseBudget(budget: string): number {
  if (!budget || budget === 'Not specified') return 500000;
  const clean = budget.replace(/[₹$,\s]/g, '').toLowerCase();
  let multiplier = 1;
  if (clean.includes('lakh') || clean.includes('lac')) multiplier = 100000;
  else if (clean.includes('crore') || clean.includes('cr')) multiplier = 10000000;
  else if (clean.endsWith('l')) multiplier = 100000;
  else if (clean.includes('k')) multiplier = 1000;
  const numMatch = clean.match(/[\d.]+/);
  return numMatch ? parseFloat(numMatch[0]) * multiplier : 500000;
}

// Classify city tier
function getCityTier(location: string): number {
  const loc = location.toLowerCase();
  const tier1 = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'gurgaon', 'gurugram', 'noida'];
  const tier2 = ['jaipur', 'lucknow', 'chandigarh', 'indore', 'bhopal', 'nagpur', 'kochi', 'coimbatore', 'vadodara', 'surat', 'visakhapatnam', 'thiruvananthapuram', 'mysore', 'mangalore', 'nashik', 'rajkot', 'madurai'];
  if (tier1.some(c => loc.includes(c))) return 1;
  if (tier2.some(c => loc.includes(c))) return 2;
  return 3;
}

// Classify business type and estimate typical setup costs
function classifyBusiness(idea: string): { type: string; minSetupCost: number; avgMargin: number; complexityScore: number; scalabilityScore: number; marketDemandScore: number } {
  const i = idea.toLowerCase();

  // Food & Beverage
  if (i.includes('restaurant') || i.includes('cafe') || i.includes('coffee'))
    return { type: 'restaurant', minSetupCost: 1000000, avgMargin: 0.25, complexityScore: 70, scalabilityScore: 50, marketDemandScore: 75 };
  if (i.includes('cloud kitchen') || i.includes('ghost kitchen'))
    return { type: 'cloud_kitchen', minSetupCost: 500000, avgMargin: 0.30, complexityScore: 55, scalabilityScore: 70, marketDemandScore: 80 };
  if (i.includes('food truck') || i.includes('street food') || i.includes('food stall'))
    return { type: 'food_stall', minSetupCost: 200000, avgMargin: 0.35, complexityScore: 40, scalabilityScore: 40, marketDemandScore: 70 };
  if (i.includes('pan shop') || i.includes('paan') || i.includes('betel'))
    return { type: 'pan_shop', minSetupCost: 100000, avgMargin: 0.40, complexityScore: 25, scalabilityScore: 30, marketDemandScore: 65 };
  if (i.includes('bakery') || i.includes('cake'))
    return { type: 'bakery', minSetupCost: 500000, avgMargin: 0.35, complexityScore: 50, scalabilityScore: 55, marketDemandScore: 70 };
  if (i.includes('tea') || i.includes('chai'))
    return { type: 'tea_shop', minSetupCost: 150000, avgMargin: 0.45, complexityScore: 20, scalabilityScore: 60, marketDemandScore: 80 };
  if (i.includes('juice') || i.includes('smoothie'))
    return { type: 'juice_shop', minSetupCost: 200000, avgMargin: 0.40, complexityScore: 30, scalabilityScore: 45, marketDemandScore: 65 };

  // Retail
  if (i.includes('grocery') || i.includes('kirana') || i.includes('general store'))
    return { type: 'grocery', minSetupCost: 300000, avgMargin: 0.15, complexityScore: 35, scalabilityScore: 45, marketDemandScore: 85 };
  if (i.includes('pharmacy') || i.includes('medical shop') || i.includes('chemist'))
    return { type: 'pharmacy', minSetupCost: 500000, avgMargin: 0.20, complexityScore: 60, scalabilityScore: 55, marketDemandScore: 90 };
  if (i.includes('clothing') || i.includes('fashion') || i.includes('boutique') || i.includes('garment'))
    return { type: 'clothing', minSetupCost: 500000, avgMargin: 0.35, complexityScore: 50, scalabilityScore: 55, marketDemandScore: 70 };
  if (i.includes('mobile') || i.includes('phone') || i.includes('electronics'))
    return { type: 'electronics', minSetupCost: 500000, avgMargin: 0.15, complexityScore: 45, scalabilityScore: 50, marketDemandScore: 75 };

  // Services
  if (i.includes('salon') || i.includes('beauty') || i.includes('parlour') || i.includes('parlor'))
    return { type: 'salon', minSetupCost: 300000, avgMargin: 0.40, complexityScore: 45, scalabilityScore: 50, marketDemandScore: 75 };
  if (i.includes('gym') || i.includes('fitness'))
    return { type: 'gym', minSetupCost: 1500000, avgMargin: 0.30, complexityScore: 60, scalabilityScore: 55, marketDemandScore: 70 };
  if (i.includes('tuition') || i.includes('coaching') || i.includes('education') || i.includes('academy'))
    return { type: 'education', minSetupCost: 200000, avgMargin: 0.50, complexityScore: 40, scalabilityScore: 65, marketDemandScore: 80 };
  if (i.includes('laundry') || i.includes('dry clean'))
    return { type: 'laundry', minSetupCost: 300000, avgMargin: 0.35, complexityScore: 35, scalabilityScore: 60, marketDemandScore: 65 };

  // Tech
  if (i.includes('app') || i.includes('software') || i.includes('saas') || i.includes('tech startup'))
    return { type: 'tech', minSetupCost: 300000, avgMargin: 0.60, complexityScore: 80, scalabilityScore: 90, marketDemandScore: 75 };
  if (i.includes('ecommerce') || i.includes('e-commerce') || i.includes('online store'))
    return { type: 'ecommerce', minSetupCost: 200000, avgMargin: 0.30, complexityScore: 55, scalabilityScore: 80, marketDemandScore: 75 };
  if (i.includes('freelanc') || i.includes('consulting') || i.includes('agency'))
    return { type: 'consulting', minSetupCost: 50000, avgMargin: 0.55, complexityScore: 50, scalabilityScore: 60, marketDemandScore: 70 };

  // Default
  return { type: 'general', minSetupCost: 300000, avgMargin: 0.25, complexityScore: 50, scalabilityScore: 50, marketDemandScore: 60 };
}

// The core deterministic decision engine
function makeDecision(businessIdea: string, location: string, budget: string): DecisionResult {
  const budgetAmount = parseBudget(budget);
  const cityTier = getCityTier(location);
  const biz = classifyBusiness(businessIdea);

  // --- Tier multiplier for costs ---
  const tierCostMultiplier = cityTier === 1 ? 1.5 : cityTier === 2 ? 1.0 : 0.7;
  const adjustedMinCost = biz.minSetupCost * tierCostMultiplier;

  // --- 1. Budget Fit (0-100) ---
  const budgetRatio = budgetAmount / adjustedMinCost;
  let budgetFit: number;
  if (budgetRatio >= 2.0) budgetFit = 95;
  else if (budgetRatio >= 1.5) budgetFit = 85;
  else if (budgetRatio >= 1.0) budgetFit = 70;
  else if (budgetRatio >= 0.7) budgetFit = 50;
  else if (budgetRatio >= 0.5) budgetFit = 35;
  else if (budgetRatio >= 0.3) budgetFit = 20;
  else budgetFit = 10;

  // --- 2. Location Viability (0-100) ---
  // Tier 1: high footfall but high cost; Tier 3: low cost but low demand
  let locationViability: number;
  if (cityTier === 1) locationViability = budgetRatio >= 1.0 ? 80 : 55;
  else if (cityTier === 2) locationViability = budgetRatio >= 0.8 ? 75 : 60;
  else locationViability = budgetRatio >= 0.6 ? 70 : 65;

  // --- 3. Business Complexity (inverted: higher = simpler = better) ---
  const businessComplexity = 100 - biz.complexityScore;

  // --- 4. Market Potential ---
  const marketPotential = biz.marketDemandScore;

  // --- 5. Scalability ---
  const scalability = biz.scalabilityScore;

  // --- 6. Risk Level (higher = less risky = better) ---
  let riskLevel: number;
  if (budgetRatio >= 1.5 && biz.complexityScore <= 40) riskLevel = 85;
  else if (budgetRatio >= 1.0 && biz.complexityScore <= 60) riskLevel = 65;
  else if (budgetRatio >= 0.7) riskLevel = 45;
  else if (budgetRatio >= 0.4) riskLevel = 30;
  else riskLevel = 15;

  const scoringFactors: ScoringFactors = { budgetFit, locationViability, businessComplexity, marketPotential, scalability, riskLevel };

  // --- Weighted Score ---
  const weights = { budgetFit: 0.25, locationViability: 0.15, businessComplexity: 0.10, marketPotential: 0.20, scalability: 0.10, riskLevel: 0.20 };
  const score = Math.round(
    budgetFit * weights.budgetFit +
    locationViability * weights.locationViability +
    businessComplexity * weights.businessComplexity +
    marketPotential * weights.marketPotential +
    scalability * weights.scalability +
    riskLevel * weights.riskLevel
  );

  // --- Verdict ---
  let verdict: 'GO' | 'CAUTION' | 'AVOID';
  if (score >= 68 && budgetFit >= 50 && riskLevel >= 40) verdict = 'GO';
  else if (score < 40 || budgetFit < 20 || riskLevel < 20) verdict = 'AVOID';
  else verdict = 'CAUTION';

  // --- Financial Projections ---
  const monthlyRevenue = budgetAmount * biz.avgMargin * (cityTier === 1 ? 1.3 : cityTier === 2 ? 1.0 : 0.75);
  const monthlyExpenses = adjustedMinCost * 0.08; // ~8% of setup as monthly operating cost
  const breakEvenMonths = monthlyRevenue > monthlyExpenses
    ? Math.ceil(adjustedMinCost / (monthlyRevenue - monthlyExpenses))
    : 36; // cap at 3 years if unprofitable
  const roi = monthlyRevenue > monthlyExpenses
    ? Math.round(((monthlyRevenue - monthlyExpenses) * 12 / budgetAmount) * 100)
    : -Math.round((monthlyExpenses - monthlyRevenue) * 12 / budgetAmount * 100);

  const currentYear = new Date().getFullYear();
  const growthRates = [1.0, 1.20, 1.40, 1.55, 1.70];
  const financialProjections = growthRates.map((g, i) => {
    const rev = Math.round(monthlyRevenue * 12 * g);
    const exp = Math.round(monthlyExpenses * 12 * (1 + i * 0.05));
    return { year: currentYear + i, revenue: rev, expenses: exp, profit: rev - exp };
  });

  // --- Competition estimate based on type & tier ---
  const baseCompetitors = cityTier === 1 ? 25 : cityTier === 2 ? 15 : 8;
  const directCompetitors = Math.round(baseCompetitors * (biz.marketDemandScore / 100));
  const indirectCompetitors = Math.round(directCompetitors * 1.5);

  // --- Risk severities ---
  const riskSeverities: Array<'low' | 'medium' | 'high'> = [];
  if (budgetFit < 30) riskSeverities.push('high');
  if (budgetFit < 50) riskSeverities.push('medium');
  if (riskLevel < 30) riskSeverities.push('high');
  if (locationViability < 50) riskSeverities.push('medium');
  if (riskSeverities.length === 0) riskSeverities.push('low');

  return { score, verdict, scoringFactors, breakEvenMonths, roi, financialProjections, directCompetitors, indirectCompetitors, riskSeverities };
}

// ============================================
// AI EXPLANATION ENGINE (explanations only)
// ============================================

async function getAIExplanations(businessIdea: string, location: string, budget: string, decision: DecisionResult) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('SERVICE_CONFIG_ERROR');

  const systemPrompt = `You are an expert business analyst for Indian markets. You will be given a business idea, location, budget, and a PRE-COMPUTED decision with scores. Your job is ONLY to provide rich, location-specific EXPLANATIONS and qualitative insights. Do NOT change the scores, verdict, or financial numbers — they are final.

Return valid JSON with this EXACT structure:
{
  "summary": "<2-3 sentence executive summary referencing the specific location and budget>",
  "marketExplanation": "<3-4 sentences about the local market conditions, footfall, demographics in this specific neighborhood>",
  "competitionExplanation": "<3-4 sentences about competitors in this exact area, what they do differently>",
  "financialExplanation": "<3-4 sentences explaining the financial outlook given the budget and location costs>",
  "competitiveAdvantage": "<1-2 sentences on how to differentiate>",
  "threats": ["<specific threat 1>", "<specific threat 2>", "<specific threat 3>"],
  "opportunities": ["<specific opportunity 1>", "<specific opportunity 2>", "<specific opportunity 3>"],
  "risks": [
    {"risk": "<specific risk>", "severity": "${decision.riskSeverities[0] || 'medium'}", "mitigation": "<actionable mitigation>"},
    {"risk": "<specific risk>", "severity": "medium", "mitigation": "<actionable mitigation>"},
    {"risk": "<specific risk>", "severity": "low", "mitigation": "<actionable mitigation>"}
  ],
  "recommendations": ["<actionable rec 1>", "<actionable rec 2>", "<actionable rec 3>", "<actionable rec 4>"],
  "roadmapPhases": [
    {"phase": "Phase 1: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]},
    {"phase": "Phase 2: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]},
    {"phase": "Phase 3: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]}
  ],
  "roadmapExplanation": "<why this roadmap fits>",
  "expertInsights": "<2-3 paragraphs of expert analysis with neighborhood-specific insights>",
  "marketSize": "<estimated local market size>",
  "marketGrowth": "<growth trend>"
}

Be SPECIFIC to the neighborhood/city. Mention local landmarks, nearby competition, local rent norms, and regional regulations.`;

  const userPrompt = `Business Idea: ${businessIdea}
Location: ${location}
Budget: ${budget}

PRE-COMPUTED DECISION (DO NOT CHANGE THESE):
- Score: ${decision.score}/100
- Verdict: ${decision.verdict}
- Budget Fit: ${decision.scoringFactors.budgetFit}/100
- Location Viability: ${decision.scoringFactors.locationViability}/100
- Market Potential: ${decision.scoringFactors.marketPotential}/100
- Risk Level: ${decision.scoringFactors.riskLevel}/100
- Break-even: ${decision.breakEvenMonths} months
- ROI: ${decision.roi}%
- Estimated competitors nearby: ${decision.directCompetitors} direct, ${decision.indirectCompetitors} indirect

Provide location-specific EXPLANATIONS and qualitative insights for this analysis. Reference the pre-computed numbers in your explanations.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('RATE_LIMITED');
    if (response.status === 402) throw new Error('CREDITS_EXHAUSTED');
    throw new Error('SERVICE_ERROR');
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error('EMPTY_RESPONSE');

  let jsonContent = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonContent = jsonMatch[1].trim();

  return JSON.parse(jsonContent);
}

// ============================================
// Monthly breakdown with seasonal variance
// ============================================

function generateYearlyWithMonths(yearlyData: Array<{ year: number; revenue: number; expenses: number; profit: number }>) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonalWeights = [0.07, 0.06, 0.08, 0.08, 0.08, 0.08, 0.08, 0.09, 0.09, 0.10, 0.10, 0.09];
  return yearlyData.map((y) => ({
    ...y,
    months: monthNames.map((month, i) => ({
      month,
      revenue: Math.round(y.revenue * seasonalWeights[i]),
      expenses: Math.round(y.expenses / 12),
      profit: Math.round(y.revenue * seasonalWeights[i] - y.expenses / 12),
    })),
  }));
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.user.id;
    console.log('Authenticated user:', userId.substring(0, 8) + '...');

    // Validate input
    let body: unknown;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const validation = validateInput(body);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { businessIdea, location, budget } = validation.data;

    // ============================================
    // STEP 1: Deterministic Decision
    // ============================================
    const decision = makeDecision(businessIdea, location, budget);
    console.log(`Decision: score=${decision.score}, verdict=${decision.verdict}`);

    // ============================================
    // STEP 2: AI Explanations Only
    // ============================================
    const aiExplanations = await getAIExplanations(businessIdea, location, budget, decision);

    // ============================================
    // STEP 3: Assemble Final Response
    // ============================================
    const analysis = {
      verdict: decision.verdict,
      score: decision.score,
      summary: aiExplanations.summary || `Analysis complete for ${businessIdea} in ${location}.`,
      marketAnalysis: {
        size: aiExplanations.marketSize || 'Data pending',
        growth: aiExplanations.marketGrowth || 'Data pending',
        competition: `${decision.directCompetitors} direct, ${decision.indirectCompetitors} indirect`,
        explanation: aiExplanations.marketExplanation || '',
      },
      financialProjection: {
        yearlyData: generateYearlyWithMonths(decision.financialProjections),
        breakEvenMonths: decision.breakEvenMonths,
        roi: decision.roi,
        explanation: aiExplanations.financialExplanation || '',
      },
      competitionAnalysis: {
        directCompetitors: decision.directCompetitors,
        indirectCompetitors: decision.indirectCompetitors,
        competitiveAdvantage: aiExplanations.competitiveAdvantage || '',
        threats: aiExplanations.threats || [],
        opportunities: aiExplanations.opportunities || [],
        explanation: aiExplanations.competitionExplanation || '',
      },
      roadmap: {
        phases: aiExplanations.roadmapPhases || [],
        explanation: aiExplanations.roadmapExplanation || '',
      },
      risks: aiExplanations.risks || [],
      recommendations: aiExplanations.recommendations || [],
      expertInsights: aiExplanations.expertInsights || '',
      scoringFactors: decision.scoringFactors,
    };

    return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.error('Request failed:', errorMessage);
    const errorMap: Record<string, { status: number; message: string }> = {
      'RATE_LIMITED': { status: 429, message: 'Service is busy. Please try again in a moment.' },
      'CREDITS_EXHAUSTED': { status: 503, message: 'Service temporarily unavailable.' },
      'SERVICE_CONFIG_ERROR': { status: 503, message: 'Service configuration error.' },
      'SERVICE_ERROR': { status: 503, message: 'Analysis service unavailable. Please try again.' },
      'EMPTY_RESPONSE': { status: 500, message: 'Analysis incomplete. Please try again.' },
    };
    const errorResponse = errorMap[errorMessage] || { status: 500, message: 'Analysis failed. Please try again.' };
    return new Response(JSON.stringify({ error: errorResponse.message }), { status: errorResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

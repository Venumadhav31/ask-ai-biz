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
// HELPER: Call AI Gateway
// ============================================

async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 3000, temperature = 0.4): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('SERVICE_CONFIG_ERROR');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
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
  return content;
}

function parseJSON(raw: string): unknown {
  let jsonContent = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonContent = jsonMatch[1].trim();
  return JSON.parse(jsonContent);
}

// ============================================
// REAL-TIME DATA: Firecrawl Web Search + World Bank Population
// ============================================

interface RealTimeData {
  webSearchResults: string;
  populationData: string;
}

async function fetchRealTimeData(businessIdea: string, location: string): Promise<RealTimeData> {
  const results: RealTimeData = { webSearchResults: '', populationData: '' };

  // Extract city/region for population lookup
  const locationParts = location.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const cityName = locationParts.length > 0 ? locationParts[locationParts.length - 1] : '';

  // Run Firecrawl search + World Bank API in parallel
  const [webResult, popResult] = await Promise.allSettled([
    fetchFirecrawlSearch(businessIdea, location),
    fetchPopulationData(cityName || location),
  ]);

  if (webResult.status === 'fulfilled') results.webSearchResults = webResult.value;
  else console.error('Firecrawl search failed:', webResult.reason);

  if (popResult.status === 'fulfilled') results.populationData = popResult.value;
  else console.error('Population data failed:', popResult.reason);

  return results;
}

async function fetchFirecrawlSearch(businessIdea: string, location: string): Promise<string> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.warn('FIRECRAWL_API_KEY not configured, skipping web search');
    return '';
  }

  try {
    // Search for market data about this business + location
    const query = `${businessIdea} market size competition ${location} India 2025`;
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl search error:', response.status);
      return '';
    }

    const data = await response.json();
    if (!data.success || !data.data) return '';

    // Compile search results into a context string
    const snippets = data.data
      .slice(0, 5)
      .map((r: any, i: number) => {
        const title = r.title || 'Untitled';
        const url = r.url || '';
        const content = (r.markdown || r.description || '').slice(0, 500);
        return `[${i + 1}] ${title}\nSource: ${url}\n${content}`;
      })
      .join('\n\n');

    return snippets || '';
  } catch (err) {
    console.error('Firecrawl search exception:', err);
    return '';
  }
}

async function fetchPopulationData(location: string): Promise<string> {
  try {
    // Use World Bank API for India population data
    const indiaPopRes = await fetch(
      'https://api.worldbank.org/v2/country/IND/indicator/SP.POP.TOTL?format=json&date=2020:2024&per_page=5',
      { signal: AbortSignal.timeout(5000) }
    );

    let populationInfo = '';

    if (indiaPopRes.ok) {
      const popData = await indiaPopRes.json();
      if (Array.isArray(popData) && popData[1]) {
        const latest = popData[1][0];
        populationInfo += `India Total Population (${latest.date}): ${(latest.value / 1e9).toFixed(2)} billion\n`;
        // Growth rate from last 2 entries
        if (popData[1].length >= 2) {
          const prev = popData[1][1];
          const growthRate = ((latest.value - prev.value) / prev.value * 100).toFixed(2);
          populationInfo += `Annual Population Growth: ${growthRate}%\n`;
        }
      }
    }

    // Also fetch urban population percentage
    const urbanRes = await fetch(
      'https://api.worldbank.org/v2/country/IND/indicator/SP.URB.TOTL.IN.ZS?format=json&date=2020:2024&per_page=5',
      { signal: AbortSignal.timeout(5000) }
    );

    if (urbanRes.ok) {
      const urbanData = await urbanRes.json();
      if (Array.isArray(urbanData) && urbanData[1]?.[0]) {
        populationInfo += `Urban Population: ${parseFloat(urbanData[1][0].value).toFixed(1)}%\n`;
      }
    }

    // GDP per capita for economic context
    const gdpRes = await fetch(
      'https://api.worldbank.org/v2/country/IND/indicator/NY.GDP.PCAP.CD?format=json&date=2020:2024&per_page=5',
      { signal: AbortSignal.timeout(5000) }
    );

    if (gdpRes.ok) {
      const gdpData = await gdpRes.json();
      if (Array.isArray(gdpData) && gdpData[1]?.[0]) {
        populationInfo += `GDP Per Capita: $${Math.round(gdpData[1][0].value)}\n`;
      }
    }

    if (location && location !== 'Not specified') {
      populationInfo += `\nNote: For city-level population of "${location}", use census estimates in analysis.\n`;
    }

    return populationInfo;
  } catch (err) {
    console.error('Population API error:', err);
    return '';
  }
}

// ============================================
// SANITIZATION: Strip dangerous content from AI responses
// ============================================

function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  // Remove HTML tags, script injections, and dangerous patterns
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .replace(/&#/g, '')
    .trim()
    .slice(0, 5000);
}

function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(sanitizeString).filter(Boolean).slice(0, 20);
}

function sanitizePass1(data: Pass1Result): Pass1Result {
  return {
    ...data,
    factors: (data.factors || []).slice(0, 10).map(f => ({
      name: sanitizeString(f.name).slice(0, 100),
      weight: Math.max(0, Math.min(1, Number(f.weight) || 0)),
      score: Math.max(0, Math.min(100, Math.round(Number(f.score) || 0))),
      reasoning: sanitizeString(f.reasoning).slice(0, 500),
      isLocationSpecific: Boolean(f.isLocationSpecific),
    })),
    marketData: (data.marketData || []).slice(0, 20).map(d => ({
      metric: sanitizeString(d.metric).slice(0, 100),
      minValue: Number(d.minValue) || 0,
      maxValue: Number(d.maxValue) || 0,
      estimatedValue: Number(d.estimatedValue) || 0,
      unit: sanitizeString(d.unit).slice(0, 20),
      source: sanitizeString(d.source).slice(0, 200),
      confidence: (['high', 'medium', 'low'].includes(d.confidence) ? d.confidence : 'low') as 'high' | 'medium' | 'low',
    })),
    estimatedSetupCostMin: Math.max(0, Number(data.estimatedSetupCostMin) || 0),
    estimatedSetupCostMax: Math.max(0, Number(data.estimatedSetupCostMax) || 0),
    estimatedMonthlyRevenueMin: Math.max(0, Number(data.estimatedMonthlyRevenueMin) || 0),
    estimatedMonthlyRevenueMax: Math.max(0, Number(data.estimatedMonthlyRevenueMax) || 0),
    estimatedMonthlyExpensesMin: Math.max(0, Number(data.estimatedMonthlyExpensesMin) || 0),
    estimatedMonthlyExpensesMax: Math.max(0, Number(data.estimatedMonthlyExpensesMax) || 0),
    avgProfitMargin: Math.max(0, Math.min(1, Number(data.avgProfitMargin) || 0)),
    directCompetitors: Math.max(0, Math.round(Number(data.directCompetitors) || 0)),
    indirectCompetitors: Math.max(0, Math.round(Number(data.indirectCompetitors) || 0)),
    marketSize: sanitizeString(data.marketSize).slice(0, 200),
    marketGrowth: sanitizeString(data.marketGrowth).slice(0, 200),
  };
}

function sanitizePass3(data: Record<string, unknown>): Record<string, unknown> {
  return {
    summary: sanitizeString(data.summary),
    marketExplanation: sanitizeString(data.marketExplanation),
    competitionExplanation: sanitizeString(data.competitionExplanation),
    financialExplanation: sanitizeString(data.financialExplanation),
    competitiveAdvantage: sanitizeString(data.competitiveAdvantage),
    threats: sanitizeStringArray(data.threats),
    opportunities: sanitizeStringArray(data.opportunities),
    risks: Array.isArray(data.risks) ? data.risks.slice(0, 10).map((r: any) => ({
      risk: sanitizeString(r?.risk),
      severity: ['low', 'medium', 'high'].includes(r?.severity) ? r.severity : 'medium',
      mitigation: sanitizeString(r?.mitigation),
    })) : [],
    recommendations: sanitizeStringArray(data.recommendations),
    roadmapPhases: Array.isArray(data.roadmapPhases) ? data.roadmapPhases.slice(0, 5).map((p: any) => ({
      phase: sanitizeString(p?.phase).slice(0, 100),
      duration: sanitizeString(p?.duration).slice(0, 50),
      tasks: sanitizeStringArray(p?.tasks),
      milestones: sanitizeStringArray(p?.milestones),
    })) : [],
    roadmapExplanation: sanitizeString(data.roadmapExplanation),
    expertInsights: sanitizeString(data.expertInsights),
  };
}

// ============================================
// PASS 1: Dynamic Factor Discovery + Market Intel
// ============================================

interface MarketDataPoint {
  metric: string;
  minValue: number;
  maxValue: number;
  estimatedValue: number;
  unit: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

interface DynamicFactor {
  name: string;
  weight: number; // 0.0 - 1.0, all weights must sum to 1.0
  score: number;  // 0 - 100
  reasoning: string;
  isLocationSpecific: boolean;
}

interface Pass1Result {
  factors: DynamicFactor[];
  marketData: MarketDataPoint[];
  estimatedSetupCostMin: number;
  estimatedSetupCostMax: number;
  estimatedMonthlyRevenueMin: number;
  estimatedMonthlyRevenueMax: number;
  estimatedMonthlyExpensesMin: number;
  estimatedMonthlyExpensesMax: number;
  avgProfitMargin: number;
  directCompetitors: number;
  indirectCompetitors: number;
  marketSize: string;
  marketGrowth: string;
}

async function pass1_discoverFactorsAndData(businessIdea: string, location: string, budget: string, realTimeData?: RealTimeData): Promise<Pass1Result> {
  const realTimeContext = realTimeData ? `

REAL-TIME WEB DATA (use this to ground your estimates):
${realTimeData.webSearchResults ? `\n--- Web Search Results ---\n${realTimeData.webSearchResults}` : '(No web data available)'}

${realTimeData.populationData ? `\n--- Population & Economic Data (World Bank) ---\n${realTimeData.populationData}` : '(No population data available)'}

IMPORTANT: Use the real-time data above to calibrate your market size estimates, competitor counts, and cost figures. Reference specific data points from these sources when available.` : '';

  const systemPrompt = `You are an expert Indian market research analyst with deep knowledge of real estate costs, competitor landscapes, regulatory environments, and consumer behavior across all Indian cities, towns, and villages.

Your task: Given a business idea, location, and budget, you must:

1. IDENTIFY the most relevant scoring factors for THIS specific business+location combo. Do NOT use a fixed set — adapt based on what actually matters. Examples:
   - A laundry in a drought-prone village → "Water Availability" is critical
   - A tech startup in Bangalore → "Talent Pool Access" matters
   - A restaurant near a college → "Student Footfall" is key
   - A pharmacy anywhere → "Regulatory Compliance" is important
   
   Always include at least 4 and at most 8 factors. Each must have a weight (all weights sum to 1.0) and a score (0-100).

2. ESTIMATE real market data with min/max ranges:
   - Setup costs (rent deposit, equipment, licenses, renovation) for THIS specific location
   - Monthly revenue potential based on local demand
   - Monthly operating expenses (rent, staff, utilities, supplies)
   - Competitor count in the area
   - Local market size and growth

Use your knowledge of Indian geography, economics, and demographics. Be SPECIFIC — mention actual neighborhoods, local costs, nearby landmarks if relevant.
${realTimeContext}

Return ONLY valid JSON:
{
  "factors": [
    {"name": "<factor name>", "weight": <0.0-1.0>, "score": <0-100>, "reasoning": "<1-2 sentences>", "isLocationSpecific": <true/false>}
  ],
  "marketData": [
    {"metric": "<name>", "minValue": <number>, "maxValue": <number>, "estimatedValue": <number>, "unit": "<INR/count/percent/sqft>", "source": "<basis of estimate>", "confidence": "<high/medium/low>"}
  ],
  "estimatedSetupCostMin": <number in INR>,
  "estimatedSetupCostMax": <number in INR>,
  "estimatedMonthlyRevenueMin": <number in INR>,
  "estimatedMonthlyRevenueMax": <number in INR>,
  "estimatedMonthlyExpensesMin": <number in INR>,
  "estimatedMonthlyExpensesMax": <number in INR>,
  "avgProfitMargin": <0.0-1.0>,
  "directCompetitors": <number>,
  "indirectCompetitors": <number>,
  "marketSize": "<string>",
  "marketGrowth": "<string>"
}

CRITICAL: weights MUST sum to exactly 1.0. Scores must reflect realistic assessment, not optimism.`;

  const userPrompt = `Business Idea: ${businessIdea}
Location: ${location}
Budget: ${budget}

Analyze this specific combination and return the dynamic factors and market data.`;

  const raw = await callAI(systemPrompt, userPrompt, 3000, 0.3);
  const parsed = parseJSON(raw) as Pass1Result;
  return sanitizePass1(parsed);
}

// ============================================
// PASS 2: Deterministic Scoring Engine
// ============================================

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

interface ScoringResult {
  score: number;
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  factors: DynamicFactor[];
  breakEvenMonths: number;
  roi: number;
  financialProjections: Array<{ year: number; revenue: number; expenses: number; profit: number }>;
  budgetFitPercent: number;
}

function pass2_score(pass1: Pass1Result, budget: string): ScoringResult {
  const budgetAmount = parseBudget(budget);

  // --- Weighted score from dynamic factors ---
  let totalWeight = 0;
  let weightedSum = 0;
  for (const f of pass1.factors) {
    weightedSum += f.score * f.weight;
    totalWeight += f.weight;
  }
  // Normalize in case weights don't perfectly sum to 1
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 50;

  // --- Budget Fit as a modifier ---
  const avgSetupCost = (pass1.estimatedSetupCostMin + pass1.estimatedSetupCostMax) / 2;
  const budgetRatio = avgSetupCost > 0 ? budgetAmount / avgSetupCost : 1;
  let budgetModifier: number;
  if (budgetRatio >= 2.0) budgetModifier = 1.15;
  else if (budgetRatio >= 1.5) budgetModifier = 1.10;
  else if (budgetRatio >= 1.0) budgetModifier = 1.0;
  else if (budgetRatio >= 0.7) budgetModifier = 0.85;
  else if (budgetRatio >= 0.5) budgetModifier = 0.70;
  else if (budgetRatio >= 0.3) budgetModifier = 0.55;
  else budgetModifier = 0.40;

  const budgetFitPercent = Math.min(100, Math.round(budgetRatio * 100));
  const score = Math.round(Math.min(100, Math.max(0, rawScore * budgetModifier)));

  // --- Verdict ---
  let verdict: 'GO' | 'CAUTION' | 'AVOID';
  if (score >= 65 && budgetFitPercent >= 50) verdict = 'GO';
  else if (score < 35 || budgetFitPercent < 25) verdict = 'AVOID';
  else verdict = 'CAUTION';

  // --- Financial Projections ---
  const avgMonthlyRevenue = (pass1.estimatedMonthlyRevenueMin + pass1.estimatedMonthlyRevenueMax) / 2;
  const avgMonthlyExpenses = (pass1.estimatedMonthlyExpensesMin + pass1.estimatedMonthlyExpensesMax) / 2;
  const monthlyProfit = avgMonthlyRevenue - avgMonthlyExpenses;

  const breakEvenMonths = monthlyProfit > 0
    ? Math.ceil(avgSetupCost / monthlyProfit)
    : 36;

  const roi = monthlyProfit > 0
    ? Math.round((monthlyProfit * 12 / budgetAmount) * 100)
    : -Math.round((Math.abs(monthlyProfit) * 12 / budgetAmount) * 100);

  const currentYear = new Date().getFullYear();
  const growthRates = [1.0, 1.15, 1.30, 1.45, 1.60];
  const financialProjections = growthRates.map((g, i) => {
    const rev = Math.round(avgMonthlyRevenue * 12 * g);
    const exp = Math.round(avgMonthlyExpenses * 12 * (1 + i * 0.05));
    return { year: currentYear + i, revenue: rev, expenses: exp, profit: rev - exp };
  });

  return { score, verdict, factors: pass1.factors, breakEvenMonths, roi, financialProjections, budgetFitPercent };
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
// PASS 3: AI Explanations
// ============================================

async function pass3_explain(businessIdea: string, location: string, budget: string, scoring: ScoringResult, pass1: Pass1Result) {
  const factorsSummary = scoring.factors.map(f =>
    `- ${f.name}: ${f.score}/100 (weight: ${(f.weight * 100).toFixed(0)}%) — ${f.reasoning}`
  ).join('\n');

  const systemPrompt = `You are an expert business analyst for Indian markets. You will be given a business idea, location, budget, and a PRE-COMPUTED decision with dynamic scoring factors and market data. Your job is ONLY to provide rich, location-specific EXPLANATIONS and qualitative insights. Do NOT change the scores, verdict, or financial numbers — they are final.

Return valid JSON with this EXACT structure:
{
  "summary": "<2-3 sentence executive summary referencing the specific location and budget>",
  "marketExplanation": "<3-4 sentences about the local market conditions, footfall, demographics in this specific area>",
  "competitionExplanation": "<3-4 sentences about competitors in this exact area>",
  "financialExplanation": "<3-4 sentences explaining the financial outlook given the budget and location costs>",
  "competitiveAdvantage": "<1-2 sentences on how to differentiate>",
  "threats": ["<specific threat 1>", "<specific threat 2>", "<specific threat 3>"],
  "opportunities": ["<specific opportunity 1>", "<specific opportunity 2>", "<specific opportunity 3>"],
  "risks": [
    {"risk": "<specific risk>", "severity": "<low/medium/high>", "mitigation": "<actionable mitigation>"},
    {"risk": "<specific risk>", "severity": "<low/medium/high>", "mitigation": "<actionable mitigation>"},
    {"risk": "<specific risk>", "severity": "<low/medium/high>", "mitigation": "<actionable mitigation>"}
  ],
  "recommendations": ["<actionable rec 1>", "<actionable rec 2>", "<actionable rec 3>", "<actionable rec 4>"],
  "roadmapPhases": [
    {"phase": "Phase 1: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]},
    {"phase": "Phase 2: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]},
    {"phase": "Phase 3: <name>", "duration": "<timeframe>", "tasks": ["<task>", "<task>"], "milestones": ["<milestone>"]}
  ],
  "roadmapExplanation": "<why this roadmap fits>",
  "expertInsights": "<2-3 paragraphs of expert analysis with neighborhood-specific insights>"
}

Be SPECIFIC to the neighborhood/city. Mention local landmarks, nearby competition, local rent norms, and regional regulations.`;

  const userPrompt = `Business Idea: ${businessIdea}
Location: ${location}
Budget: ${budget}

PRE-COMPUTED DECISION (DO NOT CHANGE):
- Score: ${scoring.score}/100
- Verdict: ${scoring.verdict}
- Budget Fit: ${scoring.budgetFitPercent}%
- Break-even: ${scoring.breakEvenMonths} months
- ROI: ${scoring.roi}%
- Direct Competitors: ${pass1.directCompetitors}
- Indirect Competitors: ${pass1.indirectCompetitors}
- Market Size: ${pass1.marketSize}
- Market Growth: ${pass1.marketGrowth}

DYNAMIC SCORING FACTORS:
${factorsSummary}

MARKET DATA:
${pass1.marketData.map(d => `- ${d.metric}: ${d.estimatedValue} ${d.unit} (range: ${d.minValue}-${d.maxValue}, confidence: ${d.confidence})`).join('\n')}

Setup Cost Range: ₹${pass1.estimatedSetupCostMin.toLocaleString()} - ₹${pass1.estimatedSetupCostMax.toLocaleString()}
Monthly Revenue Range: ₹${pass1.estimatedMonthlyRevenueMin.toLocaleString()} - ₹${pass1.estimatedMonthlyRevenueMax.toLocaleString()}
Monthly Expenses Range: ₹${pass1.estimatedMonthlyExpensesMin.toLocaleString()} - ₹${pass1.estimatedMonthlyExpensesMax.toLocaleString()}

Provide location-specific EXPLANATIONS for this analysis.`;

  const raw = await callAI(systemPrompt, userPrompt, 3500, 0.8);
  const parsed = parseJSON(raw) as Record<string, unknown>;
  return sanitizePass3(parsed);
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
    // PRE-PASS: Fetch real-time web & population data
    // ============================================
    console.log('Pre-pass: Fetching real-time data...');
    const realTimeData = await fetchRealTimeData(businessIdea, location);
    console.log(`Real-time data: web=${realTimeData.webSearchResults.length > 0 ? 'YES' : 'NO'}, population=${realTimeData.populationData.length > 0 ? 'YES' : 'NO'}`);

    // ============================================
    // PASS 1: Discover dynamic factors + market data
    // ============================================
    console.log('Pass 1: Discovering factors and market data...');
    const pass1 = await pass1_discoverFactorsAndData(businessIdea, location, budget, realTimeData);
    console.log(`Pass 1 complete: ${pass1.factors.length} factors, ${pass1.marketData.length} data points`);

    // ============================================
    // PASS 2: Deterministic scoring
    // ============================================
    console.log('Pass 2: Scoring...');
    const scoring = pass2_score(pass1, budget);
    console.log(`Pass 2 complete: score=${scoring.score}, verdict=${scoring.verdict}`);

    // ============================================
    // PASS 3: AI explanations
    // ============================================
    console.log('Pass 3: Generating explanations...');
    const aiExplanations = await pass3_explain(businessIdea, location, budget, scoring, pass1);

    // ============================================
    // Assemble Final Response
    // ============================================
    const analysis = {
      verdict: scoring.verdict,
      score: scoring.score,
      summary: (aiExplanations.summary as string) || `Analysis complete for ${businessIdea} in ${location}.`,
      scoringFactors: Object.fromEntries(scoring.factors.map(f => [f.name.replace(/\s+/g, ''), f.score])),
      dynamicFactors: scoring.factors,
      marketData: pass1.marketData,
      marketAnalysis: {
        size: pass1.marketSize || 'Data pending',
        growth: pass1.marketGrowth || 'Data pending',
        competition: `${pass1.directCompetitors} direct, ${pass1.indirectCompetitors} indirect`,
        explanation: (aiExplanations.marketExplanation as string) || '',
      },
      financialProjection: {
        yearlyData: generateYearlyWithMonths(scoring.financialProjections),
        breakEvenMonths: scoring.breakEvenMonths,
        roi: scoring.roi,
        explanation: (aiExplanations.financialExplanation as string) || '',
        setupCostRange: { min: pass1.estimatedSetupCostMin, max: pass1.estimatedSetupCostMax },
        monthlyRevenueRange: { min: pass1.estimatedMonthlyRevenueMin, max: pass1.estimatedMonthlyRevenueMax },
        monthlyExpensesRange: { min: pass1.estimatedMonthlyExpensesMin, max: pass1.estimatedMonthlyExpensesMax },
      },
      competitionAnalysis: {
        directCompetitors: pass1.directCompetitors,
        indirectCompetitors: pass1.indirectCompetitors,
        competitiveAdvantage: (aiExplanations.competitiveAdvantage as string) || '',
        threats: (aiExplanations.threats as string[]) || [],
        opportunities: (aiExplanations.opportunities as string[]) || [],
        explanation: (aiExplanations.competitionExplanation as string) || '',
      },
      roadmap: {
        phases: (aiExplanations.roadmapPhases as unknown[]) || [],
        explanation: (aiExplanations.roadmapExplanation as string) || '',
      },
      risks: (aiExplanations.risks as unknown[]) || [],
      recommendations: (aiExplanations.recommendations as string[]) || [],
      expertInsights: (aiExplanations.expertInsights as string) || '',
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

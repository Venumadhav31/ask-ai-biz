/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Dynamic CORS - allows preview URLs and production domain
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  
  const allowedOrigins = [
    'https://lovable.dev',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
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
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { businessIdea, location, budget } = body as Record<string, unknown>;

  // Validate businessIdea (required, 10-2000 chars)
  if (!businessIdea || typeof businessIdea !== 'string') {
    return { valid: false, error: 'Business idea is required' };
  }
  const trimmedIdea = businessIdea.trim();
  if (trimmedIdea.length < 10) {
    return { valid: false, error: 'Business idea must be at least 10 characters' };
  }
  if (trimmedIdea.length > 2000) {
    return { valid: false, error: 'Business idea must be less than 2000 characters' };
  }

  // Validate location (optional, max 200 chars)
  let trimmedLocation = '';
  if (location) {
    if (typeof location !== 'string') {
      return { valid: false, error: 'Location must be a string' };
    }
    trimmedLocation = location.trim();
    if (trimmedLocation.length > 200) {
      return { valid: false, error: 'Location must be less than 200 characters' };
    }
  }

  // Validate budget (optional, max 100 chars)
  let trimmedBudget = '';
  if (budget) {
    if (typeof budget !== 'string') {
      return { valid: false, error: 'Budget must be a string' };
    }
    trimmedBudget = budget.trim();
    if (trimmedBudget.length > 100) {
      return { valid: false, error: 'Budget must be less than 100 characters' };
    }
  }

  return {
    valid: true,
    data: {
      businessIdea: trimmedIdea,
      location: trimmedLocation || 'Not specified',
      budget: trimmedBudget || 'Not specified',
    },
  };
}

// ============================================
// AI ANALYSIS ENGINE
// ============================================

async function analyzeWithAI(businessIdea: string, location: string, budget: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('SERVICE_CONFIG_ERROR');
  }

  const systemPrompt = `You are an expert business analyst for Indian markets. Analyze the business idea and provide a comprehensive feasibility assessment.

Your analysis must be data-driven, specific to the location, and consider:
- Local market conditions and consumer behavior
- Regional competition landscape
- Budget adequacy for the specific business type
- Regulatory requirements in that region
- Economic factors and growth trends

IMPORTANT: Return your response as valid JSON matching this EXACT structure:
{
  "verdict": "GO" | "CAUTION" | "AVOID",
  "score": <number 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "marketAnalysis": {
    "marketSize": "<estimated market size>",
    "marketGrowth": "<growth rate and trends>",
    "marketExplanation": "<3-4 sentences on local market conditions>"
  },
  "competitionAnalysis": {
    "directCompetitors": <number>,
    "indirectCompetitors": <number>,
    "competitiveAdvantage": "<key differentiator>",
    "competitionExplanation": "<3-4 sentences on competitive landscape>"
  },
  "financialAnalysis": {
    "breakEvenMonths": <number>,
    "roi": <percentage number>,
    "financialExplanation": "<3-4 sentences on financial outlook>"
  },
  "scoringFactors": {
    "marketSize": <0-100>,
    "competition": <0-100>,
    "budgetFit": <0-100>,
    "locationViability": <0-100>,
    "industryGrowth": <0-100>,
    "riskLevel": <0-100>
  },
  "threats": ["<threat1>", "<threat2>", "<threat3>"],
  "opportunities": ["<opportunity1>", "<opportunity2>", "<opportunity3>"],
  "risks": [
    {"risk": "<description>", "severity": "low" | "medium" | "high", "mitigation": "<how to handle>"}
  ],
  "recommendations": ["<actionable recommendation 1>", "<actionable recommendation 2>", "<actionable recommendation 3>"],
  "roadmapPhases": [
    {"phase": "Phase 1: <name>", "duration": "<timeframe>", "tasks": ["<task1>", "<task2>"], "milestones": ["<milestone1>"]},
    {"phase": "Phase 2: <name>", "duration": "<timeframe>", "tasks": ["<task1>", "<task2>"], "milestones": ["<milestone1>"]},
    {"phase": "Phase 3: <name>", "duration": "<timeframe>", "tasks": ["<task1>", "<task2>"], "milestones": ["<milestone1>"]}
  ],
  "roadmapExplanation": "<why this roadmap makes sense>",
  "expertInsights": "<2-3 paragraphs of expert analysis with specific local insights>",
  "financialProjections": [
    {"year": 2025, "revenue": <number>, "expenses": <number>, "profit": <number>},
    {"year": 2026, "revenue": <number>, "expenses": <number>, "profit": <number>},
    {"year": 2027, "revenue": <number>, "expenses": <number>, "profit": <number>},
    {"year": 2028, "revenue": <number>, "expenses": <number>, "profit": <number>},
    {"year": 2029, "revenue": <number>, "expenses": <number>, "profit": <number>}
  ]
}

SCORING GUIDELINES:
- GO: Score 68+ with good budget fit and manageable risk
- CAUTION: Score 45-67 or high-risk factors present
- AVOID: Score below 45 or critical issues

Consider Indian-specific factors:
- City tiers (Tier 1: Mumbai, Delhi, Bangalore; Tier 2: Jaipur, Lucknow; Tier 3: smaller towns)
- Budget formats (lakhs, crores, "5l" = 5 lakhs)
- Local regulations and licenses
- Festival seasons and regional preferences`;

  const userPrompt = `Analyze this business idea:

Business Idea: ${businessIdea}
Location: ${location}
Budget: ${budget}

Provide a thorough analysis with specific insights for the location mentioned.`;

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
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    if (response.status === 402) {
      throw new Error('CREDITS_EXHAUSTED');
    }
    console.error('Analysis service error:', { status: response.status });
    throw new Error('SERVICE_ERROR');
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('EMPTY_RESPONSE');
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
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============================================
    // AUTHENTICATION CHECK
    // ============================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;
    console.log('Authenticated user:', userId.substring(0, 8) + '...');

    // ============================================
    // INPUT VALIDATION
    // ============================================
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateInput(body);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { businessIdea, location, budget } = validation.data;
    console.log('Processing analysis request for user:', userId.substring(0, 8) + '...');

    // ============================================
    // AI ANALYSIS
    // ============================================
    const aiAnalysis = await analyzeWithAI(businessIdea, location, budget);

    const analysis = {
      verdict: aiAnalysis.verdict?.toUpperCase() || 'CAUTION',
      score: aiAnalysis.score || 50,
      summary: aiAnalysis.summary || 'Analysis complete.',
      marketAnalysis: {
        size: aiAnalysis.marketAnalysis?.marketSize || 'Analysis pending',
        growth: aiAnalysis.marketAnalysis?.marketGrowth || 'Analysis pending',
        competition: `${aiAnalysis.competitionAnalysis?.directCompetitors || 10} direct, ${aiAnalysis.competitionAnalysis?.indirectCompetitors || 15} indirect`,
        explanation: aiAnalysis.marketAnalysis?.marketExplanation || aiAnalysis.expertInsights || '',
      },
      financialProjection: {
        yearlyData: generateYearlyWithMonths(aiAnalysis.financialProjections || generateDefaultProjections(budget)),
        breakEvenMonths: aiAnalysis.financialAnalysis?.breakEvenMonths || 18,
        roi: aiAnalysis.financialAnalysis?.roi || 15,
        explanation: aiAnalysis.financialAnalysis?.financialExplanation || '',
      },
      competitionAnalysis: {
        directCompetitors: aiAnalysis.competitionAnalysis?.directCompetitors || 10,
        indirectCompetitors: aiAnalysis.competitionAnalysis?.indirectCompetitors || 15,
        competitiveAdvantage: aiAnalysis.competitionAnalysis?.competitiveAdvantage || '',
        threats: aiAnalysis.threats || [],
        opportunities: aiAnalysis.opportunities || [],
        explanation: aiAnalysis.competitionAnalysis?.competitionExplanation || '',
      },
      roadmap: {
        phases: aiAnalysis.roadmapPhases || [],
        explanation: aiAnalysis.roadmapExplanation || '',
      },
      risks: aiAnalysis.risks || [],
      recommendations: aiAnalysis.recommendations || [],
      expertInsights: aiAnalysis.expertInsights || '',
    };

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.error('Request failed:', errorMessage);

    // Map internal errors to user-friendly messages
    const errorMap: Record<string, { status: number; message: string }> = {
      'RATE_LIMITED': { status: 429, message: 'Service is busy. Please try again in a moment.' },
      'CREDITS_EXHAUSTED': { status: 503, message: 'Service temporarily unavailable.' },
      'SERVICE_CONFIG_ERROR': { status: 503, message: 'Service configuration error.' },
      'SERVICE_ERROR': { status: 503, message: 'Analysis service unavailable. Please try again.' },
      'EMPTY_RESPONSE': { status: 500, message: 'Analysis incomplete. Please try again.' },
    };

    const errorResponse = errorMap[errorMessage] || { status: 500, message: 'Analysis failed. Please try again.' };

    return new Response(
      JSON.stringify({ error: errorResponse.message }),
      { status: errorResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate monthly breakdowns from yearly data with seasonal variance
function generateYearlyWithMonths(yearlyData: Array<{year: number; revenue: number; expenses: number; profit: number}>) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Seasonal weights for Indian market (festive season boost Oct-Dec, slow Jan-Feb)
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

// Fallback projections if AI doesn't provide them
function generateDefaultProjections(budget: string) {
  const budgetAmount = parseBudgetSimple(budget);
  const years = [2025, 2026, 2027, 2028, 2029];
  const growthRates = [1, 1.25, 1.45, 1.6, 1.75];

  return years.map((year, idx) => ({
    year,
    revenue: Math.round(budgetAmount * 0.8 * growthRates[idx]),
    expenses: Math.round(budgetAmount * 0.5 * (1 + idx * 0.08)),
    profit: Math.round(budgetAmount * 0.3 * growthRates[idx]),
  }));
}

function parseBudgetSimple(budget: string): number {
  if (!budget) return 500000;
  const cleanBudget = budget.replace(/[₹$,\s]/g, '').toLowerCase();
  let multiplier = 1;
  
  if (cleanBudget.includes('lakh') || cleanBudget.includes('lac')) multiplier = 100000;
  else if (cleanBudget.includes('cr')) multiplier = 10000000;
  else if (cleanBudget.endsWith('l')) multiplier = 100000;
  else if (cleanBudget.includes('k')) multiplier = 1000;
  
  const numMatch = cleanBudget.match(/[\d.]+/);
  return numMatch ? parseFloat(numMatch[0]) * multiplier : 500000;
}

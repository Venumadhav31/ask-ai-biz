/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// Dynamic CORS - allows preview URLs and production domain
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  
  // Allow Lovable preview URLs, localhost, and production domain
  const allowedOrigins = [
    'https://lovable.dev',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
  // Allow any lovable.app subdomain (preview URLs)
  const isLovablePreview = origin.includes('.lovable.app') || origin.includes('.lovableproject.com');
  const isAllowed = allowedOrigins.includes(origin) || isLovablePreview;
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface AnalysisRequest {
  businessIdea: string;
  location: string;
  budget: string;
}

// ============================================
// AI-ONLY ANALYSIS ENGINE
// All decisions, scoring, and reasoning from AI
// ============================================

async function analyzeWithAI(businessIdea: string, location: string, budget: string) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
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
    {"risk": "<description>", "severity": "low" | "medium" | "high", "mitigation": "<how to handle>"},
    {"risk": "<description>", "severity": "low" | "medium" | "high", "mitigation": "<how to handle>"},
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
- AVOID: Score below 45 or critical issues (regulatory, obsolete business model, severe underfunding)

Consider Indian-specific factors:
- City tiers (Tier 1: Mumbai, Delhi, Bangalore; Tier 2: Jaipur, Lucknow; Tier 3: smaller towns)
- Budget formats (lakhs, crores, "5l" = 5 lakhs)
- Local regulations and licenses
- Festival seasons and regional preferences
- Competition from both organized and unorganized sectors`;

  const userPrompt = `Analyze this business idea:

Business Idea: ${businessIdea}
Location: ${location || 'Not specified (assume major Indian city)'}
Budget: ${budget || 'Not specified'}

Provide a thorough analysis with specific insights for the location mentioned. Be realistic and data-driven in your assessment.`;

  console.log('Calling AI for full analysis...');
  
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
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('API credits exhausted. Please add credits.');
    }
    const errorText = await response.text();
    console.error('AI Gateway error:', errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from AI');
  }

  console.log('AI response received, parsing...');

  // Extract JSON from potential markdown code blocks
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
    const { businessIdea, location, budget }: AnalysisRequest = await req.json();

    if (!businessIdea) {
      return new Response(
        JSON.stringify({ error: 'Business idea is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing with AI: ${businessIdea} in ${location} with budget ${budget}`);

    // Get complete analysis from AI
    const aiAnalysis = await analyzeWithAI(businessIdea, location, budget);

    console.log(`AI verdict: ${aiAnalysis.verdict}, score: ${aiAnalysis.score}`);

    // Build the final response structure matching BusinessAnalysis interface
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
        yearlyData: aiAnalysis.financialProjections || generateDefaultProjections(budget),
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
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ error: 'Analysis failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

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

interface AnalysisResponse {
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  score: number;
  summary: string;
  marketAnalysis: {
    size: string;
    growth: string;
    competition: string;
    explanation: string;
  };
  financialProjection: {
    yearlyData: Array<{
      year: number;
      revenue: number;
      expenses: number;
      profit: number;
      months?: Array<{
        month: string;
        revenue: number;
        expenses: number;
        profit: number;
      }>;
    }>;
    breakEvenMonths: number;
    roi: number;
    explanation: string;
  };
  competitionAnalysis: {
    directCompetitors: number;
    indirectCompetitors: number;
    competitiveAdvantage: string;
    threats: string[];
    opportunities: string[];
    explanation: string;
  };
  roadmap: {
    phases: Array<{
      phase: string;
      duration: string;
      tasks: string[];
      milestones: string[];
    }>;
    explanation: string;
  };
  risks: Array<{
    risk: string;
    severity: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  recommendations: string[];
  expertInsights: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an expert business analyst and strategy consultant with 20+ years of experience advising startups and SMEs in India. You provide detailed, data-driven feasibility analysis with location-specific insights.

Your analysis style:
- Speak like a seasoned business consultant, not a generic AI
- Reference actual local market conditions, neighborhoods, and competitive landscape
- Use specific numbers and percentages based on realistic industry benchmarks
- Mention actual competitor types, footfall patterns, and local business dynamics
- Be direct about risks - don't sugarcoat

For financial projections:
- Base calculations on realistic industry margins (e.g., 15-25% for cloud kitchens, 10-15% for retail)
- Account for seasonality and local festivals
- Consider real estate costs, labor costs, and utilities specific to the location

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
  "verdict": "GO" | "CAUTION" | "AVOID",
  "score": number (0-100),
  "summary": "2-3 sentence expert summary",
  "marketAnalysis": {
    "size": "Market size estimate",
    "growth": "Growth rate",
    "competition": "Competition level",
    "explanation": "Detailed 3-4 sentence expert explanation with local specifics"
  },
  "financialProjection": {
    "yearlyData": [
      {
        "year": 2025,
        "revenue": number,
        "expenses": number,
        "profit": number,
        "months": [
          {"month": "Jan", "revenue": number, "expenses": number, "profit": number},
          ...all 12 months
        ]
      },
      ...years 2026-2029
    ],
    "breakEvenMonths": number,
    "roi": number,
    "explanation": "Expert financial analysis with industry benchmarks"
  },
  "competitionAnalysis": {
    "directCompetitors": number,
    "indirectCompetitors": number,
    "competitiveAdvantage": "Your key differentiator",
    "threats": ["threat1", "threat2", "threat3"],
    "opportunities": ["opp1", "opp2", "opp3"],
    "explanation": "Competition analysis with local market context"
  },
  "roadmap": {
    "phases": [
      {
        "phase": "Phase name",
        "duration": "X months",
        "tasks": ["task1", "task2"],
        "milestones": ["milestone1"]
      }
    ],
    "explanation": "Implementation roadmap rationale"
  },
  "risks": [
    {"risk": "description", "severity": "low|medium|high", "mitigation": "strategy"}
  ],
  "recommendations": ["actionable rec 1", "actionable rec 2", "actionable rec 3"],
  "expertInsights": "2-3 paragraph expert narrative with specific local insights, industry wisdom, and actionable advice. Mention actual places, competitor types, and market dynamics in ${location}."
}`;

    const userPrompt = `Analyze this business idea for feasibility:

Business Idea: ${businessIdea}
Location: ${location || 'Not specified (assume major Indian city)'}
Budget: ${budget || 'Not specified'}

Provide a comprehensive feasibility analysis with:
1. Clear GO/CAUTION/AVOID verdict with score
2. Market size and growth potential for this specific location
3. 5-year financial projection with monthly breakdown for year 1
4. Competition analysis with local market context
5. Implementation roadmap with phases
6. Risk assessment with mitigation strategies
7. Expert insights with location-specific advice

Be specific about ${location || 'the Indian market'} - mention actual neighborhoods, footfall patterns, competitor presence, and local business dynamics.`;

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
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    let analysis: AnalysisResponse;
    try {
      analysis = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonContent);
      throw new Error('Failed to parse AI analysis response');
    }

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

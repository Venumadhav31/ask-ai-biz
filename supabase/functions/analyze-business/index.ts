/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  cityPopulationData: string;
}

async function fetchRealTimeData(businessIdea: string, location: string): Promise<RealTimeData> {
  const results: RealTimeData = { webSearchResults: '', populationData: '', cityPopulationData: '' };

  // Extract city name from location string
  const locationParts = location.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const cityName = locationParts.length > 0 ? locationParts[locationParts.length - 1] : '';

  // Run all data fetches in parallel
  const [webResult, popResult, cityPopResult] = await Promise.allSettled([
    fetchFirecrawlSearch(businessIdea, location),
    fetchPopulationData(cityName || location),
    fetchCityPopulationData(cityName || location),
  ]);

  if (webResult.status === 'fulfilled') results.webSearchResults = webResult.value;
  else console.error('Firecrawl search failed:', webResult.reason);

  if (popResult.status === 'fulfilled') results.populationData = popResult.value;
  else console.error('Population data failed:', popResult.reason);

  if (cityPopResult.status === 'fulfilled') results.cityPopulationData = cityPopResult.value;
  else console.error('City population data failed:', cityPopResult.reason);

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
      populationInfo += `\nNote: For city-level population of "${location}", see city demographics data.\n`;
    }

    return populationInfo;
  } catch (err) {
    console.error('Population API error:', err);
    return '';
  }
}

// Major Indian cities population database (Census 2011 + projected 2025 estimates)
const INDIA_CITY_POPULATION: Record<string, { population2011: number; metro2011: number; growthRate: number; tier: string; state: string; literacyRate: number; avgIncome: string }> = {
  'mumbai': { population2011: 12442373, metro2011: 20748395, growthRate: 1.2, tier: 'Tier 1', state: 'Maharashtra', literacyRate: 89.7, avgIncome: '₹4.5L/year' },
  'delhi': { population2011: 11034555, metro2011: 16787941, growthRate: 1.9, tier: 'Tier 1', state: 'Delhi NCR', literacyRate: 86.3, avgIncome: '₹4.0L/year' },
  'bangalore': { population2011: 8443675, metro2011: 10456000, growthRate: 3.5, tier: 'Tier 1', state: 'Karnataka', literacyRate: 87.7, avgIncome: '₹5.2L/year' },
  'bengaluru': { population2011: 8443675, metro2011: 10456000, growthRate: 3.5, tier: 'Tier 1', state: 'Karnataka', literacyRate: 87.7, avgIncome: '₹5.2L/year' },
  'hyderabad': { population2011: 6993262, metro2011: 9746000, growthRate: 2.8, tier: 'Tier 1', state: 'Telangana', literacyRate: 83.3, avgIncome: '₹4.0L/year' },
  'ahmedabad': { population2011: 5577940, metro2011: 7650000, growthRate: 2.0, tier: 'Tier 1', state: 'Gujarat', literacyRate: 86.7, avgIncome: '₹3.5L/year' },
  'chennai': { population2011: 4681087, metro2011: 8696010, growthRate: 1.3, tier: 'Tier 1', state: 'Tamil Nadu', literacyRate: 90.2, avgIncome: '₹4.2L/year' },
  'kolkata': { population2011: 4496694, metro2011: 14112536, growthRate: 0.6, tier: 'Tier 1', state: 'West Bengal', literacyRate: 87.1, avgIncome: '₹3.0L/year' },
  'pune': { population2011: 3124458, metro2011: 7276000, growthRate: 2.5, tier: 'Tier 1', state: 'Maharashtra', literacyRate: 91.7, avgIncome: '₹4.8L/year' },
  'jaipur': { population2011: 3073350, metro2011: 3700000, growthRate: 2.3, tier: 'Tier 1', state: 'Rajasthan', literacyRate: 82.3, avgIncome: '₹2.8L/year' },
  'lucknow': { population2011: 2815601, metro2011: 3500000, growthRate: 2.1, tier: 'Tier 1', state: 'Uttar Pradesh', literacyRate: 77.3, avgIncome: '₹2.5L/year' },
  'kanpur': { population2011: 2767031, metro2011: 3100000, growthRate: 1.0, tier: 'Tier 2', state: 'Uttar Pradesh', literacyRate: 79.7, avgIncome: '₹2.2L/year' },
  'nagpur': { population2011: 2405421, metro2011: 2900000, growthRate: 1.5, tier: 'Tier 2', state: 'Maharashtra', literacyRate: 91.9, avgIncome: '₹2.8L/year' },
  'indore': { population2011: 1964086, metro2011: 2500000, growthRate: 2.6, tier: 'Tier 2', state: 'Madhya Pradesh', literacyRate: 86.0, avgIncome: '₹2.5L/year' },
  'thane': { population2011: 1841488, metro2011: 2200000, growthRate: 2.2, tier: 'Tier 2', state: 'Maharashtra', literacyRate: 91.4, avgIncome: '₹3.8L/year' },
  'bhopal': { population2011: 1798218, metro2011: 2300000, growthRate: 1.8, tier: 'Tier 2', state: 'Madhya Pradesh', literacyRate: 84.1, avgIncome: '₹2.4L/year' },
  'visakhapatnam': { population2011: 1730320, metro2011: 2100000, growthRate: 2.0, tier: 'Tier 2', state: 'Andhra Pradesh', literacyRate: 81.8, avgIncome: '₹2.6L/year' },
  'vadodara': { population2011: 1666703, metro2011: 2100000, growthRate: 1.8, tier: 'Tier 2', state: 'Gujarat', literacyRate: 89.2, avgIncome: '₹3.0L/year' },
  'patna': { population2011: 1684222, metro2011: 2200000, growthRate: 2.3, tier: 'Tier 2', state: 'Bihar', literacyRate: 70.7, avgIncome: '₹1.8L/year' },
  'ghaziabad': { population2011: 1648643, metro2011: 2000000, growthRate: 3.0, tier: 'Tier 2', state: 'Uttar Pradesh', literacyRate: 85.1, avgIncome: '₹3.2L/year' },
  'ludhiana': { population2011: 1613878, metro2011: 1900000, growthRate: 1.5, tier: 'Tier 2', state: 'Punjab', literacyRate: 85.5, avgIncome: '₹3.2L/year' },
  'coimbatore': { population2011: 1601438, metro2011: 2100000, growthRate: 1.7, tier: 'Tier 2', state: 'Tamil Nadu', literacyRate: 93.0, avgIncome: '₹3.5L/year' },
  'agra': { population2011: 1585704, metro2011: 1900000, growthRate: 1.3, tier: 'Tier 2', state: 'Uttar Pradesh', literacyRate: 73.0, avgIncome: '₹2.0L/year' },
  'kochi': { population2011: 677381, metro2011: 2100000, growthRate: 1.8, tier: 'Tier 2', state: 'Kerala', literacyRate: 97.0, avgIncome: '₹3.8L/year' },
  'chandigarh': { population2011: 1055450, metro2011: 1200000, growthRate: 1.7, tier: 'Tier 2', state: 'Chandigarh', literacyRate: 86.1, avgIncome: '₹3.8L/year' },
  'surat': { population2011: 4462002, metro2011: 6100000, growthRate: 3.1, tier: 'Tier 1', state: 'Gujarat', literacyRate: 85.5, avgIncome: '₹3.2L/year' },
  'noida': { population2011: 642381, metro2011: 900000, growthRate: 4.5, tier: 'Tier 2', state: 'Uttar Pradesh', literacyRate: 88.0, avgIncome: '₹4.5L/year' },
  'gurgaon': { population2011: 876969, metro2011: 1500000, growthRate: 4.2, tier: 'Tier 2', state: 'Haryana', literacyRate: 84.7, avgIncome: '₹5.5L/year' },
  'gurugram': { population2011: 876969, metro2011: 1500000, growthRate: 4.2, tier: 'Tier 2', state: 'Haryana', literacyRate: 84.7, avgIncome: '₹5.5L/year' },
  'mysore': { population2011: 920550, metro2011: 1100000, growthRate: 1.6, tier: 'Tier 2', state: 'Karnataka', literacyRate: 86.1, avgIncome: '₹2.8L/year' },
  'mysuru': { population2011: 920550, metro2011: 1100000, growthRate: 1.6, tier: 'Tier 2', state: 'Karnataka', literacyRate: 86.1, avgIncome: '₹2.8L/year' },
  'mangalore': { population2011: 623841, metro2011: 750000, growthRate: 1.4, tier: 'Tier 2', state: 'Karnataka', literacyRate: 93.4, avgIncome: '₹3.0L/year' },
  'mangaluru': { population2011: 623841, metro2011: 750000, growthRate: 1.4, tier: 'Tier 2', state: 'Karnataka', literacyRate: 93.4, avgIncome: '₹3.0L/year' },
  'trivandrum': { population2011: 957730, metro2011: 1600000, growthRate: 0.8, tier: 'Tier 2', state: 'Kerala', literacyRate: 93.7, avgIncome: '₹3.5L/year' },
  'thiruvananthapuram': { population2011: 957730, metro2011: 1600000, growthRate: 0.8, tier: 'Tier 2', state: 'Kerala', literacyRate: 93.7, avgIncome: '₹3.5L/year' },
  'varanasi': { population2011: 1198491, metro2011: 1500000, growthRate: 1.4, tier: 'Tier 2', state: 'Uttar Pradesh', literacyRate: 75.6, avgIncome: '₹2.0L/year' },
  'ranchi': { population2011: 1073427, metro2011: 1300000, growthRate: 2.0, tier: 'Tier 2', state: 'Jharkhand', literacyRate: 87.7, avgIncome: '₹2.2L/year' },
  'dehradun': { population2011: 578420, metro2011: 800000, growthRate: 2.5, tier: 'Tier 2', state: 'Uttarakhand', literacyRate: 89.5, avgIncome: '₹2.8L/year' },
  'bhubaneswar': { population2011: 837737, metro2011: 1100000, growthRate: 2.8, tier: 'Tier 2', state: 'Odisha', literacyRate: 91.0, avgIncome: '₹2.5L/year' },
  'raipur': { population2011: 1010087, metro2011: 1300000, growthRate: 2.5, tier: 'Tier 2', state: 'Chhattisgarh', literacyRate: 85.4, avgIncome: '₹2.2L/year' },
  'guwahati': { population2011: 963429, metro2011: 1200000, growthRate: 2.2, tier: 'Tier 2', state: 'Assam', literacyRate: 91.5, avgIncome: '₹2.2L/year' },
  'amritsar': { population2011: 1132761, metro2011: 1400000, growthRate: 1.0, tier: 'Tier 2', state: 'Punjab', literacyRate: 85.3, avgIncome: '₹2.5L/year' },
  'jodhpur': { population2011: 1033918, metro2011: 1300000, growthRate: 2.1, tier: 'Tier 2', state: 'Rajasthan', literacyRate: 73.6, avgIncome: '₹2.0L/year' },
  'nashik': { population2011: 1486053, metro2011: 1900000, growthRate: 2.0, tier: 'Tier 2', state: 'Maharashtra', literacyRate: 89.8, avgIncome: '₹2.6L/year' },
  'madurai': { population2011: 1016885, metro2011: 1500000, growthRate: 0.9, tier: 'Tier 2', state: 'Tamil Nadu', literacyRate: 90.8, avgIncome: '₹2.5L/year' },
  'vijayawada': { population2011: 1048240, metro2011: 1500000, growthRate: 2.0, tier: 'Tier 2', state: 'Andhra Pradesh', literacyRate: 80.0, avgIncome: '₹2.3L/year' },
  'koramangala': { population2011: 8443675, metro2011: 10456000, growthRate: 3.5, tier: 'Tier 1', state: 'Karnataka', literacyRate: 87.7, avgIncome: '₹5.2L/year' },
  'whitefield': { population2011: 8443675, metro2011: 10456000, growthRate: 3.5, tier: 'Tier 1', state: 'Karnataka', literacyRate: 87.7, avgIncome: '₹5.2L/year' },
  'hsr layout': { population2011: 8443675, metro2011: 10456000, growthRate: 3.5, tier: 'Tier 1', state: 'Karnataka', literacyRate: 87.7, avgIncome: '₹5.2L/year' },
  'andheri': { population2011: 12442373, metro2011: 20748395, growthRate: 1.2, tier: 'Tier 1', state: 'Maharashtra', literacyRate: 89.7, avgIncome: '₹4.5L/year' },
  'bandra': { population2011: 12442373, metro2011: 20748395, growthRate: 1.2, tier: 'Tier 1', state: 'Maharashtra', literacyRate: 89.7, avgIncome: '₹4.5L/year' },
  'powai': { population2011: 12442373, metro2011: 20748395, growthRate: 1.2, tier: 'Tier 1', state: 'Maharashtra', literacyRate: 89.7, avgIncome: '₹4.5L/year' },
  'connaught place': { population2011: 11034555, metro2011: 16787941, growthRate: 1.9, tier: 'Tier 1', state: 'Delhi NCR', literacyRate: 86.3, avgIncome: '₹4.0L/year' },
  'dwarka': { population2011: 11034555, metro2011: 16787941, growthRate: 1.9, tier: 'Tier 1', state: 'Delhi NCR', literacyRate: 86.3, avgIncome: '₹4.0L/year' },
  'hitec city': { population2011: 6993262, metro2011: 9746000, growthRate: 2.8, tier: 'Tier 1', state: 'Telangana', literacyRate: 83.3, avgIncome: '₹4.0L/year' },
  'gachibowli': { population2011: 6993262, metro2011: 9746000, growthRate: 2.8, tier: 'Tier 1', state: 'Telangana', literacyRate: 83.3, avgIncome: '₹4.0L/year' },
};

async function fetchCityPopulationData(location: string): Promise<string> {
  if (!location || location === 'Not specified') return '';

  try {
    const normalizedLocation = location.toLowerCase().trim();

    // Try exact match first, then try each word in location
    let cityData = INDIA_CITY_POPULATION[normalizedLocation];
    if (!cityData) {
      const words = normalizedLocation.split(/[\s,]+/);
      for (const word of words) {
        if (INDIA_CITY_POPULATION[word]) {
          cityData = INDIA_CITY_POPULATION[word];
          break;
        }
      }
    }

    if (!cityData) {
      return `City-level data for "${location}" not found in database. AI should estimate based on regional knowledge.\n`;
    }

    // Project to 2025 from 2011 census
    const yearsSince = 2025 - 2011;
    const projectedCity = Math.round(cityData.population2011 * Math.pow(1 + cityData.growthRate / 100, yearsSince));
    const projectedMetro = Math.round(cityData.metro2011 * Math.pow(1 + cityData.growthRate / 100, yearsSince));

    let info = `\n--- City-Level Demographics (Census + Projections) ---\n`;
    info += `City: ${location}\n`;
    info += `State: ${cityData.state}\n`;
    info += `Tier: ${cityData.tier}\n`;
    info += `Census 2011 City Population: ${cityData.population2011.toLocaleString()}\n`;
    info += `Census 2011 Metro Population: ${cityData.metro2011.toLocaleString()}\n`;
    info += `Projected 2025 City Population: ~${(projectedCity / 1e6).toFixed(1)} million\n`;
    info += `Projected 2025 Metro Population: ~${(projectedMetro / 1e6).toFixed(1)} million\n`;
    info += `Annual Growth Rate: ${cityData.growthRate}%\n`;
    info += `Literacy Rate: ${cityData.literacyRate}%\n`;
    info += `Average Household Income: ${cityData.avgIncome}\n`;

    return info;
  } catch (err) {
    console.error('City population lookup error:', err);
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

${realTimeData.populationData ? `\n--- National Population & Economic Data (World Bank) ---\n${realTimeData.populationData}` : '(No national population data available)'}

${realTimeData.cityPopulationData ? `\n${realTimeData.cityPopulationData}` : '(No city-level data available)'}

IMPORTANT: Use the real-time data above to calibrate your market size estimates, competitor counts, and cost figures. Use city-level demographics (population, tier, literacy, income) to estimate local demand and spending power. Reference specific data points from these sources when available.` : '';

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
// PASS 2: XGBoost-Style Gradient Boosted Decision Tree Scoring
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

// --- XGBoost-style GBDT Engine ---

interface GBDTFeatures {
  avgFactorScore: number;       // 0-100: weighted avg of Pass 1 factors
  budgetRatio: number;          // 0-5+: budget / setup cost
  competitionDensity: number;   // 0-1: normalized competitor pressure
  marketGrowthSignal: number;   // 0-1: growth potential
  profitMarginEstimate: number; // 0-1: estimated margin
  locationTierScore: number;    // 0-1: tier-based opportunity
  revenueToExpenseRatio: number;// 0-5+: revenue / expenses
  factorVariance: number;       // 0-1: how spread out factor scores are (risk signal)
  topFactorScore: number;       // 0-100: best factor score
  bottomFactorScore: number;    // 0-100: worst factor score
}

// A decision stump (weak learner) in the ensemble
interface DecisionStump {
  featureKey: keyof GBDTFeatures;
  threshold: number;
  leftValue: number;   // prediction if feature <= threshold
  rightValue: number;  // prediction if feature > threshold
  weight: number;      // learning rate × contribution
}

// Interaction stump: splits on product/ratio of two features
interface InteractionStump {
  featureA: keyof GBDTFeatures;
  featureB: keyof GBDTFeatures;
  operation: 'multiply' | 'divide' | 'min' | 'max';
  threshold: number;
  leftValue: number;
  rightValue: number;
  weight: number;
}

function extractFeatures(pass1: Pass1Result, budgetAmount: number): GBDTFeatures {
  // Weighted average factor score
  let totalWeight = 0, weightedSum = 0;
  let maxScore = 0, minScore = 100;
  for (const f of pass1.factors) {
    weightedSum += f.score * f.weight;
    totalWeight += f.weight;
    if (f.score > maxScore) maxScore = f.score;
    if (f.score < minScore) minScore = f.score;
  }
  const avgFactorScore = totalWeight > 0 ? weightedSum / totalWeight : 50;

  // Budget ratio
  const avgSetupCost = (pass1.estimatedSetupCostMin + pass1.estimatedSetupCostMax) / 2 || 1;
  const budgetRatio = budgetAmount / avgSetupCost;

  // Competition density: normalized 0-1 (higher = more competition = worse)
  const totalCompetitors = pass1.directCompetitors + pass1.indirectCompetitors * 0.5;
  const competitionDensity = Math.min(1, totalCompetitors / 50);

  // Market growth signal: parse from string
  const growthMatch = (pass1.marketGrowth || '').match(/([\d.]+)\s*%/);
  const growthPercent = growthMatch ? parseFloat(growthMatch[1]) : 5;
  const marketGrowthSignal = Math.min(1, growthPercent / 30);

  // Profit margin
  const profitMarginEstimate = Math.max(0, Math.min(1, pass1.avgProfitMargin || 0));

  // Location tier (extracted from factors if any mention tier)
  const tierFactor = pass1.factors.find(f => f.isLocationSpecific);
  const locationTierScore = tierFactor ? tierFactor.score / 100 : 0.5;

  // Revenue to expense ratio
  const avgRevenue = (pass1.estimatedMonthlyRevenueMin + pass1.estimatedMonthlyRevenueMax) / 2 || 1;
  const avgExpenses = (pass1.estimatedMonthlyExpensesMin + pass1.estimatedMonthlyExpensesMax) / 2 || 1;
  const revenueToExpenseRatio = avgRevenue / avgExpenses;

  // Factor variance (risk signal - high variance means inconsistent)
  const scores = pass1.factors.map(f => f.score);
  const mean = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / (scores.length || 1);
  const factorVariance = Math.min(1, Math.sqrt(variance) / 50);

  return {
    avgFactorScore,
    budgetRatio: Math.min(5, budgetRatio),
    competitionDensity,
    marketGrowthSignal,
    profitMarginEstimate,
    locationTierScore,
    revenueToExpenseRatio: Math.min(5, revenueToExpenseRatio),
    factorVariance,
    topFactorScore: maxScore,
    bottomFactorScore: minScore,
  };
}

// Pre-defined ensemble of decision stumps (domain-expert crafted trees)
// These encode non-linear business feasibility patterns learned from Indian market dynamics
const DECISION_STUMPS: DecisionStump[] = [
  // Tree 1: Core factor quality drives base prediction
  { featureKey: 'avgFactorScore', threshold: 60, leftValue: -12, rightValue: 10, weight: 0.15 },
  { featureKey: 'avgFactorScore', threshold: 40, leftValue: -18, rightValue: 5, weight: 0.12 },
  { featureKey: 'avgFactorScore', threshold: 75, leftValue: -3, rightValue: 12, weight: 0.10 },

  // Tree 2: Budget adequacy is non-linear — too little kills, excess has diminishing returns
  { featureKey: 'budgetRatio', threshold: 0.5, leftValue: -20, rightValue: 5, weight: 0.12 },
  { featureKey: 'budgetRatio', threshold: 1.0, leftValue: -8, rightValue: 6, weight: 0.10 },
  { featureKey: 'budgetRatio', threshold: 2.0, leftValue: 2, rightValue: 3, weight: 0.05 },

  // Tree 3: Competition saturates opportunity
  { featureKey: 'competitionDensity', threshold: 0.3, leftValue: 8, rightValue: -5, weight: 0.10 },
  { featureKey: 'competitionDensity', threshold: 0.7, leftValue: 3, rightValue: -12, weight: 0.08 },

  // Tree 4: Growth markets rescue marginal ideas
  { featureKey: 'marketGrowthSignal', threshold: 0.2, leftValue: -6, rightValue: 7, weight: 0.08 },
  { featureKey: 'marketGrowthSignal', threshold: 0.5, leftValue: -2, rightValue: 8, weight: 0.06 },

  // Tree 5: Profit margin viability
  { featureKey: 'profitMarginEstimate', threshold: 0.15, leftValue: -15, rightValue: 5, weight: 0.10 },
  { featureKey: 'profitMarginEstimate', threshold: 0.30, leftValue: -3, rightValue: 8, weight: 0.07 },

  // Tree 6: Revenue must cover expenses
  { featureKey: 'revenueToExpenseRatio', threshold: 1.0, leftValue: -20, rightValue: 5, weight: 0.12 },
  { featureKey: 'revenueToExpenseRatio', threshold: 1.5, leftValue: -5, rightValue: 8, weight: 0.08 },

  // Tree 7: Factor consistency (low variance = more reliable prediction)
  { featureKey: 'factorVariance', threshold: 0.4, leftValue: 3, rightValue: -6, weight: 0.06 },

  // Tree 8: Bottom factor as risk floor — one terrible factor can sink a business
  { featureKey: 'bottomFactorScore', threshold: 25, leftValue: -15, rightValue: 3, weight: 0.10 },
  { featureKey: 'bottomFactorScore', threshold: 40, leftValue: -8, rightValue: 4, weight: 0.07 },

  // Tree 9: Top factor as upside signal
  { featureKey: 'topFactorScore', threshold: 80, leftValue: -2, rightValue: 8, weight: 0.05 },

  // Tree 10: Location tier opportunity
  { featureKey: 'locationTierScore', threshold: 0.5, leftValue: -5, rightValue: 6, weight: 0.06 },
];

// Interaction trees capture non-linear feature combinations
const INTERACTION_STUMPS: InteractionStump[] = [
  // High competition + low budget = disaster
  { featureA: 'competitionDensity', featureB: 'budgetRatio', operation: 'divide', threshold: 0.5, leftValue: 5, rightValue: -10, weight: 0.10 },
  // Good margins + growing market = strong signal
  { featureA: 'profitMarginEstimate', featureB: 'marketGrowthSignal', operation: 'multiply', threshold: 0.08, leftValue: -5, rightValue: 10, weight: 0.08 },
  // Worst factor × competition = compounding risk
  { featureA: 'bottomFactorScore', featureB: 'competitionDensity', operation: 'multiply', threshold: 20, leftValue: 4, rightValue: -8, weight: 0.07 },
  // Revenue/expense ratio × budget fit = financial viability
  { featureA: 'revenueToExpenseRatio', featureB: 'budgetRatio', operation: 'min', threshold: 0.8, leftValue: -12, rightValue: 6, weight: 0.09 },
  // Best factor + location = upside potential
  { featureA: 'topFactorScore', featureB: 'locationTierScore', operation: 'multiply', threshold: 40, leftValue: -3, rightValue: 7, weight: 0.05 },
  // Factor variance × competition = uncertainty amplifier
  { featureA: 'factorVariance', featureB: 'competitionDensity', operation: 'multiply', threshold: 0.15, leftValue: 3, rightValue: -8, weight: 0.06 },
];

function computeInteraction(features: GBDTFeatures, stump: InteractionStump): number {
  const a = features[stump.featureA];
  const b = features[stump.featureB];
  let value: number;
  switch (stump.operation) {
    case 'multiply': value = a * b; break;
    case 'divide': value = b !== 0 ? a / b : 0; break;
    case 'min': value = Math.min(a, b); break;
    case 'max': value = Math.max(a, b); break;
  }
  return value <= stump.threshold ? stump.leftValue * stump.weight : stump.rightValue * stump.weight;
}

function gbdtPredict(features: GBDTFeatures): number {
  // Base prediction (intercept)
  let prediction = 50;

  // Additive contributions from single-feature stumps
  for (const stump of DECISION_STUMPS) {
    const featureValue = features[stump.featureKey];
    prediction += featureValue <= stump.threshold
      ? stump.leftValue * stump.weight
      : stump.rightValue * stump.weight;
  }

  // Additive contributions from interaction stumps
  for (const stump of INTERACTION_STUMPS) {
    prediction += computeInteraction(features, stump);
  }

  // Clamp to [0, 100]
  return Math.round(Math.min(100, Math.max(0, prediction)));
}

interface ScoringResult {
  score: number;
  verdict: 'GO' | 'CAUTION' | 'AVOID';
  factors: DynamicFactor[];
  breakEvenMonths: number;
  roi: number;
  financialProjections: Array<{ year: number; revenue: number; expenses: number; profit: number }>;
  budgetFitPercent: number;
  gbdtFeatures: GBDTFeatures; // Expose for transparency
}

function pass2_score(pass1: Pass1Result, budget: string): ScoringResult {
  const budgetAmount = parseBudget(budget);

  // Extract ML features from Pass 1 data
  const features = extractFeatures(pass1, budgetAmount);

  // Run GBDT ensemble prediction
  const score = gbdtPredict(features);

  // Verdict from score with hysteresis bands
  let verdict: 'GO' | 'CAUTION' | 'AVOID';
  if (score >= 62 && features.budgetRatio >= 0.5) verdict = 'GO';
  else if (score < 35 || features.budgetRatio < 0.25) verdict = 'AVOID';
  else verdict = 'CAUTION';

  // Budget fit
  const budgetFitPercent = Math.min(100, Math.round(features.budgetRatio * 100));

  // Financial projections
  const avgSetupCost = (pass1.estimatedSetupCostMin + pass1.estimatedSetupCostMax) / 2 || 1;
  const avgMonthlyRevenue = (pass1.estimatedMonthlyRevenueMin + pass1.estimatedMonthlyRevenueMax) / 2;
  const avgMonthlyExpenses = (pass1.estimatedMonthlyExpensesMin + pass1.estimatedMonthlyExpensesMax) / 2;
  const monthlyProfit = avgMonthlyRevenue - avgMonthlyExpenses;

  // Apply GBDT-derived confidence adjustment to financial projections
  // Score < 50 = higher risk, slower ramp-up; Score > 70 = faster traction
  const confidenceMultiplier = 0.6 + (score / 100) * 0.8; // Range: 0.6 - 1.4
  const adjustedMonthlyRevenue = avgMonthlyRevenue * confidenceMultiplier;
  const adjustedMonthlyProfit = adjustedMonthlyRevenue - avgMonthlyExpenses;

  const breakEvenMonths = adjustedMonthlyProfit > 0 ? Math.ceil(avgSetupCost / adjustedMonthlyProfit) : 36;
  const roi = adjustedMonthlyProfit > 0
    ? Math.round((adjustedMonthlyProfit * 12 / budgetAmount) * 100)
    : -Math.round((Math.abs(adjustedMonthlyProfit) * 12 / budgetAmount) * 100);

  const currentYear = new Date().getFullYear();
  // Growth trajectory varies by score: low-scoring businesses grow slower
  const baseGrowth = 0.08 + (score / 100) * 0.12; // 8%-20% annual growth based on score
  const growthRates = [1.0, 1 + baseGrowth, 1 + baseGrowth * 2, 1 + baseGrowth * 3, 1 + baseGrowth * 4];
  const financialProjections = growthRates.map((g, i) => {
    const rev = Math.round(avgMonthlyRevenue * 12 * g);
    const exp = Math.round(avgMonthlyExpenses * 12 * (1 + i * 0.05));
    return { year: currentYear + i, revenue: rev, expenses: exp, profit: rev - exp };
  });

  return { score, verdict, factors: pass1.factors, breakEvenMonths, roi, financialProjections, budgetFitPercent, gbdtFeatures: features };
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
    {"risk": "<specific risk>", "severity": "<low/medium/high>", "mitigation": "<actionable mitigation>"}
  ],
  "riskNote": "Include 3-7 risks. For AVOID verdicts include more high-severity risks (4-7 total, at least 2 high). For GO verdicts include fewer (3-4 total, mostly low/medium). Severity distribution MUST reflect the score: score < 40 = mostly high, score 40-60 = mixed, score > 70 = mostly low/medium.",
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
  // corsHeaders defined at top level
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache the rate for 1 hour (in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000;
let cachedRate: { rate: number; timestamp: number } | null = null;

async function fetchExchangeRate(): Promise<number> {
  // Check cache first
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    console.log("Returning cached exchange rate:", cachedRate.rate);
    return cachedRate.rate;
  }

  console.log("Fetching fresh exchange rate from Bank of Israel...");
  
  try {
    // Try Bank of Israel first (official source)
    const boiResponse = await fetch(
      "https://www.boi.org.il/PublicApi/GetExchangeRates?asOfDate=" + 
      new Date().toISOString().split("T")[0]
    );
    
    if (boiResponse.ok) {
      const boiData = await boiResponse.json();
      const usdRate = boiData.exchangeRates?.find(
        (r: { key: string }) => r.key === "USD"
      );
      if (usdRate?.currentExchangeRate) {
        const rate = parseFloat(usdRate.currentExchangeRate);
        cachedRate = { rate, timestamp: Date.now() };
        console.log("Got rate from BOI:", rate);
        return rate;
      }
    }
  } catch (boiError) {
    console.log("BOI API failed, trying fallback:", boiError);
  }

  try {
    // Fallback to FloatRates (free, no API key needed)
    const floatResponse = await fetch(
      "https://www.floatrates.com/daily/usd.json"
    );
    
    if (floatResponse.ok) {
      const floatData = await floatResponse.json();
      const ilsRate = floatData.ils?.rate;
      if (ilsRate) {
        const rate = parseFloat(ilsRate);
        cachedRate = { rate, timestamp: Date.now() };
        console.log("Got rate from FloatRates:", rate);
        return rate;
      }
    }
  } catch (floatError) {
    console.log("FloatRates API failed:", floatError);
  }

  // Final fallback - use a reasonable default rate
  console.log("All APIs failed, using fallback rate");
  return 3.65;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rate = await fetchExchangeRate();
    
    return new Response(
      JSON.stringify({
        success: true,
        rate,
        currency: "USD/ILS",
        source: cachedRate?.timestamp === Date.now() ? "fresh" : "cached",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching exchange rate:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

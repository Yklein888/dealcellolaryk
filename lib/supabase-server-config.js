// Server-side Supabase configuration
// Using independent Supabase project (hlswvjyegirbhoszrqyo)
// DISCONNECTED FROM LOVABLE

export const SUPABASE_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
export const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI';

// Get from environment variables with fallback to hardcoded values
export function getSupabaseConfig() {
  return {
    url: process.env.MAIN_SUPABASE_URL || SUPABASE_URL,
    serviceKey: process.env.MAIN_SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY,
  };
}

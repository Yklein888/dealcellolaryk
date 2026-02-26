// Secondary Supabase client - user's own sim-manager project (hlswvjyegirbhoszrqyo)
// Used for US SIMs feature with token-based authentication (no login required)
// URL and key are hardcoded intentionally - no env vars needed for this public anon client
//
// LAZY INIT: createClient() is deferred to first use to prevent module-level crashes.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SIMM_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const SIMM_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SIMM_URL, SIMM_ANON);
  }
  return _client;
}

// Proxy: behaves exactly like a SupabaseClient but only calls createClient() on first use,
// not at module load time. This prevents the page from crashing if initialization fails
// before React even mounts.
export const simManagerClient = new Proxy({} as SupabaseClient, {
  get(_target, prop: string) {
    const client = getClient();
    const value = (client as Record<string, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

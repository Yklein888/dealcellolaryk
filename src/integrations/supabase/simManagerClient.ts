// Secondary Supabase client - user's own sim-manager project (hlswvjyegirbhoszrqyo)
// Used for US SIMs feature with token-based authentication (no login required)
import { createClient } from '@supabase/supabase-js';

const SIMM_URL = 'https://hlswvjyegirbhoszrqyo.supabase.co';
const SIMM_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

export const simManagerClient = createClient(SIMM_URL, SIMM_ANON);

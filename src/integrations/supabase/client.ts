// Supabase client - main project qifcynwnxmtoxzpskmmt
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://qifcynwnxmtoxzpskmmt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpZmN5bndueG10b3h6cHNrbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzOTQ1MDUsImV4cCI6MjA4NDk3MDUwNX0.LvK5rUyTpe9e4DSHp6DkC66LJUfu-3J---zlSl3QWIo';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qifcynwnxmtoxzpskmmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking cellstation_sims table...');

const { data, error, count } = await supabase
  .from('cellstation_sims')
  .select('*', { count: 'exact' })
  .limit(5);

console.log('\n📊 Results:');
console.log('Error:', error);
console.log('Total Count:', count);
console.log('Sample Data (first 5):', JSON.stringify(data, null, 2));

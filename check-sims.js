import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = 'https://qifcynwnxmtoxzpskmmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3OTg4MTAsImV4cCI6MjA4NjM3NDgxMH0.KNRl4-S-XxVMcaoPPQXV5gLi6W9yYNWeHqtMok-Mpg8';

const supabase = createClient(supabaseUrl, supabaseKey);

// Check if cellstation_sims table has data
const { data, error, count } = await supabase
  .from('cellstation_sims')
  .select('*', { count: 'exact', head: false })
  .limit(5);

console.log('Error:', error);
console.log('Count:', count);
console.log('Data:', JSON.stringify(data, null, 2));

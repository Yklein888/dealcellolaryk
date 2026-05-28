import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.MAIN_SUPABASE_URL,
  process.env.MAIN_SUPABASE_SERVICE_KEY
);

// List of all tables to export
const TABLES_TO_EXPORT = [
  'rentals',
  'rental_items',
  'customers',
  'repairs',
  'inventory',
  'us_sims',
  'call_logs',
  'payment_transactions',
  'invoices',
  'user_permissions',
  'user_roles',
  'app_settings'
];

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const exportData = {};
    const errors = [];

    // Export each table
    for (const table of TABLES_TO_EXPORT) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(100000); // Safe limit to prevent memory issues

        if (error) {
          errors.push({ table, error: error.message });
          exportData[table] = [];
        } else {
          exportData[table] = data || [];
        }
      } catch (err) {
        errors.push({ table, error: err.message });
        exportData[table] = [];
      }
    }

    // Return with success status even if some tables had errors
    res.status(200).json({
      success: true,
      exportedAt: new Date().toISOString(),
      tables: exportData,
      tablesSummary: Object.keys(exportData).reduce((acc, table) => {
        acc[table] = exportData[table].length;
        return acc;
      }, {}),
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to export data',
      details: error.message
    });
  }
}

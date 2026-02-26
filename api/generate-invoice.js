const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing Supabase configuration' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customerId, customerName, rentalId, transactionId, amount, currency, description } = req.body;

    console.log('Creating invoice for:', customerName, 'Amount:', amount, currency);

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        customer_id: customerId || null,
        customer_name: customerName,
        rental_id: rentalId || null,
        transaction_id: transactionId || null,
        amount,
        currency: currency || 'ILS',
        description: description || 'חיוב',
        business_name: 'דיל סלולר',
        business_id: '201512258',
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invoice:', insertError);
      return res.status(500).json({ error: `Failed to create invoice: ${insertError.message}` });
    }

    console.log('Invoice created successfully:', invoice.id);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.amount,
        currency: invoice.currency,
        issuedAt: invoice.issued_at,
      },
    });
  } catch (error) {
    console.error('Error in generate-invoice:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}

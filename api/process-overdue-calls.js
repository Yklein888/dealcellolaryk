const { createClient } = require('@supabase/supabase-js');

async function isShabbatOrHoliday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 6) {
    console.log('Today is Shabbat, skipping processing');
    return true;
  }

  try {
    const dateStr = today.toISOString().split('T')[0];
    const response = await fetch(
      `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off&start=${dateStr}&end=${dateStr}&geo=none`
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const isHoliday = data.items?.some((item) => item.yomtov === true || item.category === 'holiday') ?? false;

    if (isHoliday) {
      console.log('Today is an Israeli holiday, skipping processing');
    }

    return isHoliday;
  } catch (error) {
    console.warn('Error checking Hebcal API:', error);
    return false;
  }
}

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send('ok');
  }

  try {
    if (await isShabbatOrHoliday()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        message: 'Skipped processing - Shabbat or Israeli holiday',
        processed: 0,
        skipped: true,
      });
    }

    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    const supabaseServiceKey = process.env.MAIN_SUPABASE_SERVICE_KEY;
    const yemotSystemNumber = process.env.YEMOT_SYSTEM_NUMBER;
    const yemotPassword = process.env.YEMOT_PASSWORD;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase credentials not configured' });
    }

    if (!yemotSystemNumber || !yemotPassword) {
      return res.status(500).json({ error: 'Yemot credentials not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log('Processing overdue calls for today:', todayStr);

    const { data: overdueRentals, error: rentalsError } = await supabase
      .from('rentals')
      .select(`id, customer_id, customer_name, end_date`)
      .eq('status', 'active')
      .lt('end_date', todayStr);

    if (rentalsError) {
      return res.status(500).json({ error: `Error fetching overdue rentals: ${rentalsError.message}` });
    }

    if (!overdueRentals || overdueRentals.length === 0) {
      console.log('No overdue active rentals found');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        message: 'No overdue rentals to process',
        processed: 0,
      });
    }

    console.log(`Found ${overdueRentals.length} overdue active rentals`);

    const results = [];

    for (const rental of overdueRentals) {
      try {
        const { data: rentalItems, error: itemsError } = await supabase
          .from('rental_items')
          .select('item_category')
          .eq('rental_id', rental.id);

        if (itemsError) {
          results.push({ rentalId: rental.id, success: false, error: itemsError.message });
          continue;
        }

        const hasSim = rentalItems?.some(
          (item) => item.item_category === 'sim_european' || item.item_category === 'sim_american'
        );

        if (!hasSim) {
          results.push({ rentalId: rental.id, success: true, error: 'No SIM cards in rental' });
          continue;
        }

        const { data: existingCalls, error: callsError } = await supabase
          .from('call_logs')
          .select('id')
          .eq('entity_type', 'rental')
          .eq('entity_id', rental.id)
          .eq('call_type', 'automatic')
          .gte('created_at', todayStr);

        if (existingCalls && existingCalls.length > 0) {
          results.push({ rentalId: rental.id, success: true, error: 'Already called today' });
          continue;
        }

        let customerPhone = null;
        if (rental.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('phone')
            .eq('id', rental.customer_id)
            .single();
          customerPhone = customer?.phone;
        }

        if (!customerPhone) {
          results.push({ rentalId: rental.id, success: false, error: 'No phone number' });
          continue;
        }

        const cleanPhone = customerPhone.replace(/\D/g, '');
        const message = `שלום ${rental.customer_name}, זוהי תזכורת ממערכת דיל סלולר. מועד ההחזרה של הציוד המושכר עבר.`;

        const yemotUrl = new URL('https://www.call2all.co.il/ym/api/RunCampaign');
        yemotUrl.searchParams.set('token', `${yemotSystemNumber}:${yemotPassword}`);
        yemotUrl.searchParams.set('phones', cleanPhone);
        yemotUrl.searchParams.set('tts', message);
        yemotUrl.searchParams.set('templateId', '1267261');

        const yemotResponse = await fetch(yemotUrl.toString());
        const yemotText = await yemotResponse.text();

        let yemotResult;
        let campaignId = null;
        try {
          yemotResult = JSON.parse(yemotText);
          campaignId = yemotResult.campaignId || yemotResult.campaign_id || null;
        } catch {
          yemotResult = { raw: yemotText };
        }

        const isSuccess = yemotResult.responseStatus === 'OK' || yemotResult.success !== undefined;

        await supabase.from('call_logs').insert({
          entity_type: 'rental',
          entity_id: rental.id,
          customer_id: rental.customer_id,
          customer_phone: cleanPhone,
          call_status: 'pending',
          campaign_id: campaignId,
          call_type: 'automatic',
          call_message: message,
        });

        results.push({ rentalId: rental.id, success: isSuccess });
      } catch (error) {
        results.push({ rentalId: rental.id, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} overdue rentals`,
      processed: results.length,
      successful: successCount,
    });
  } catch (error) {
    console.error('Error in process-overdue-calls:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}

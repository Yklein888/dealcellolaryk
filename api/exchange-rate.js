let cachedRate = null;
const CACHE_DURATION = 60 * 60 * 1000;

async function fetchExchangeRate() {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    console.log('Returning cached rate:', cachedRate.rate);
    return cachedRate.rate;
  }

  console.log('Fetching fresh exchange rate...');

  try {
    const boiResponse = await fetch(
      'https://www.boi.org.il/PublicApi/GetExchangeRates?asOfDate=' + new Date().toISOString().split('T')[0]
    );

    if (boiResponse.ok) {
      const boiData = await boiResponse.json();
      const usdRate = boiData.exchangeRates?.find((r) => r.key === 'USD');
      if (usdRate?.currentExchangeRate) {
        const rate = parseFloat(usdRate.currentExchangeRate);
        cachedRate = { rate, timestamp: Date.now() };
        return rate;
      }
    }
  } catch (e) {
    console.log('BOI API failed, trying fallback');
  }

  try {
    const floatResponse = await fetch('https://www.floatrates.com/daily/usd.json');
    if (floatResponse.ok) {
      const floatData = await floatResponse.json();
      const ilsRate = floatData.ils?.rate;
      if (ilsRate) {
        const rate = parseFloat(ilsRate);
        cachedRate = { rate, timestamp: Date.now() };
        return rate;
      }
    }
  } catch (e) {
    console.log('FloatRates API failed');
  }

  return 3.65;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(200).send('ok');
  }

  try {
    const rate = await fetchExchangeRate();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      rate,
      currency: 'USD/ILS',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}

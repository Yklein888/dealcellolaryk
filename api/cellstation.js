import crypto from 'crypto';

const CELLSTATION_BASE = 'https://cellstation.co.il/portal';

// ── Vercel timeout config ─────────────────────────────────────────────────
export const config = {
  maxDuration: 300, // Pro plan supports up to 300s (needed for activate_and_swap)
};

// ── CORS ──────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── SHA-512 ───────────────────────────────────────────────────────────────
function sha512(message) {
  return crypto.createHash('sha512').update(message).digest('hex');
}

// ── Parse all named <input> fields from HTML ──────────────────────────────
// Returns { fieldName: fieldValue } for every <input name="..."> in the HTML
function parseFormFields(html) {
  const fields = {};
  const regex = /<input\b([^>]*)>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const tag = m[1];
    const nameMatch  = tag.match(/\bname="([^"]*)"/i);
    const valueMatch = tag.match(/\bvalue="([^"]*)"/i);
    if (nameMatch) {
      fields[nameMatch[1]] = valueMatch ? valueMatch[1] : '';
    }
  }
  return fields;
}

// ── Get a hidden field value by id (no name attr) ────────────────────────
function getValueById(html, id) {
  // Try value before id
  let m = html.match(new RegExp(`<input[^>]*value="([^"]*)"[^>]*id="${id}"[^>]*>`, 'i'));
  if (m) return m[1];
  // Try id before value
  m = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*value="([^"]*)"[^>]*>`, 'i'));
  if (m) return m[1];
  return null;
}

// ── CellStation Session ───────────────────────────────────────────────────
class CellStationSession {
  constructor() {
    this.cookies = '';
    this.isLoggedIn = false;
  }

  extractCookies(headers) {
    const raw = typeof headers.get === 'function'
      ? headers.get('set-cookie')
      : headers['set-cookie'];
    if (raw) {
      const parts = raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean);
      this.cookies = this.cookies
        ? this.cookies + '; ' + parts.join('; ')
        : parts.join('; ');
    }
  }

  async login() {
    try {
      const username = process.env.CELLSTATION_USERNAME;
      const password = process.env.CELLSTATION_PASSWORD;
      if (!username || !password) {
        console.error('Missing CELLSTATION credentials');
        return false;
      }

      const loginPageRes = await fetch(CELLSTATION_BASE + '/login.php', { redirect: 'manual' });
      this.extractCookies(loginPageRes.headers);

      const hashedPassword = sha512(password);

      const loginRes = await fetch(CELLSTATION_BASE + '/process_login.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.cookies,
          'Referer': CELLSTATION_BASE + '/login.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: new URLSearchParams({ username, p: hashedPassword, password: '' }).toString(),
        redirect: 'manual',
      });
      this.extractCookies(loginRes.headers);

      if (loginRes.status === 301 || loginRes.status === 302) {
        const redirectUrl = loginRes.headers.get('location');
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith('http')
            ? redirectUrl
            : CELLSTATION_BASE + '/' + redirectUrl;
          const redirRes = await fetch(fullUrl, {
            headers: {
              'Cookie': this.cookies,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'manual',
          });
          this.extractCookies(redirRes.headers);
        }
      }

      this.isLoggedIn = true;
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      return false;
    }
  }

  async fetchAuthenticated(url, options = {}) {
    if (!this.isLoggedIn) await this.login();
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cookie': this.cookies,
        'Referer': CELLSTATION_BASE + '/index.php',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const text = await res.text();
    const isUnauthorized =
      text.trim() === 'Unauthorized access' ||
      res.status === 401 ||
      text.includes('process_login.php') ||
      (text.includes('login_form') && text.length < 5000);

    if (isUnauthorized) {
      console.log('Session expired - re-authenticating...');
      this.isLoggedIn = false;
      this.cookies = '';
      const ok = await this.login();
      if (!ok) return { ok: false, status: 401, text: async () => text, _text: text };
      const res2 = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Cookie': this.cookies,
          'Referer': CELLSTATION_BASE + '/index.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      const text2 = await res2.text();
      return { ok: res2.ok, status: res2.status, text: async () => text2, _text: text2 };
    }

    return { ok: res.ok, status: res.status, text: async () => text, _text: text };
  }

  async get(path) {
    return this.fetchAuthenticated(CELLSTATION_BASE + '/' + path);
  }

  // POST with application/x-www-form-urlencoded
  async post(path, data) {
    return this.fetchAuthenticated(CELLSTATION_BASE + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
    });
  }

  // POST with application/json (for sim_swap.php)
  async postJson(path, data) {
    return this.fetchAuthenticated(CELLSTATION_BASE + '/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(data),
    });
  }
}

// ── CSV Parser ────────────────────────────────────────────────────────────
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 7) continue;
    results.push({
      sim_number: cols[0] || null,
      uk_number: cols[1] || null,
      il_number: cols[2] || null,
      iccid: cols[3] || null,
      status_raw: cols[4] || null,
      expiry_date: cols[5] || null,
      plan: cols[6] || null,
      start_date: cols[7] || null,
      end_date: cols[8] || null,
      note: cols[9] || null,
    });
  }
  return results;
}

function normalizeDate(d) {
  // Convert dd/MM/yyyy → yyyy-MM-dd (HTML date input format)
  const m = (d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return d; // already yyyy-MM-dd, return as-is
}

function hasError(html) {
  // Only check for specific CellStation error indicators
  return html.includes('שגיאה') || html.includes('alert-danger');
}

function enrichSims(rawSims) {
  return rawSims.filter(s => s.iccid).map(sim => {
    let status = 'available', status_detail = 'unknown';
    if (sim.status_raw) {
      const s = sim.status_raw.trim();
      if (s.startsWith('בשכירות'))                { status = 'rented';    status_detail = 'active';   }
      else if (s.startsWith('זמין - תקין'))        { status = 'available'; status_detail = 'valid';    }
      else if (s.startsWith('זמין - קרוב לפקיעה')) { status = 'available'; status_detail = 'expiring'; }
      else if (s.startsWith('זמין - פג תוקף'))     { status = 'available'; status_detail = 'expired';  }
    }
    const parseDate = d => {
      if (!d) return null;
      const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : d;
    };
    return {
      ...sim,
      status,
      status_detail,
      expiry_date: parseDate(sim.expiry_date),
      start_date: parseDate(sim.start_date),
      end_date: parseDate(sim.end_date),
      customer_name: sim.note,
    };
  });
}

// ── Find CellStation rental order_id by old SIM's ICCID ──────────────────
// Scans the BH index HTML for the active rentals table
function findOrderIdByIccid(bhHtml, iccid) {
  if (!iccid) return null;
  const idx = bhHtml.indexOf(iccid);
  if (idx === -1) return null;
  // Look for rental_details link within 600 chars before or after the ICCID
  const window = bhHtml.substring(Math.max(0, idx - 600), Math.min(bhHtml.length, idx + 600));
  const linkMatch = window.match(/rental_details[^"]*id=(\d+)/i);
  return linkMatch ? linkMatch[1] : null;
}

// ── Main Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS);
    res.end('ok');
    return;
  }

  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = req.body;
    if (!body) {
      const raw = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => (data += chunk));
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      body = JSON.parse(raw);
    }
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON' });
    return;
  }

  const { action, params = {} } = body;

  const session = new CellStationSession();
  const loggedIn = await session.login();
  if (!loggedIn) {
    res.status(401).json({ success: false, error: 'Login failed' });
    return;
  }

  try {
    let result;

    switch (action) {

      // ── get_sims / sync_csv ───────────────────────────────────────────
      case 'get_sims':
      case 'sync_csv': {
        const csvRes = await session.get('content/bh/bh_export_csv.php');
        const csvText = await csvRes.text();
        const rawSims = parseCSV(csvText);
        const sims = enrichSims(rawSims);
        console.log(`${action}: fetched ${sims.length} sims from CellStation`);
        result = { success: true, action, sims, count: sims.length };
        break;
      }

      // ── check_sim_status ─────────────────────────────────────────────
      case 'check_sim_status': {
        const checkRes = await session.post('index.php?page=bh/index', { sim_lookup_search: params.sim_number });
        const html = await checkRes.text();
        result = { success: true, action: 'check_sim_status', html_length: html.length, raw_html: html };
        break;
      }

      // ── activate_sim ─────────────────────────────────────────────────
      // Correct flow:
      //   1. GET fetch_BHsim_details.php?zehut={iccid}  → returns HTML form with all hidden fields
      //   2. Parse all hidden fields from the HTML
      //   3. POST to dynamic/submit.php with hidden fields + start_rental + end_rental + price + note
      case 'activate_sim': {
        const iccid = params.iccid || '';
        if (!iccid || iccid.length < 19 || iccid.length > 20 || !/^\d+$/.test(iccid)) {
          result = { success: false, error: 'Invalid ICCID format. Must be 19-20 digits.', action: 'activate_sim' };
          break;
        }

        // Step 1: Fetch the pre-filled activation form for this SIM
        console.log(`[activate_sim] Fetching SIM details for ICCID: ${iccid}`);
        const detailsRes = await session.get(`content/dashboard/rentals/fetch_BHsim_details.php?zehut=${iccid}`);
        const detailsHtml = await detailsRes.text();

        // Check if SIM was found (form should contain 'FormSubmit' and 'product')
        if (!detailsHtml.includes('FormSubmit') || !detailsHtml.includes('name="product"')) {
          console.error('[activate_sim] SIM not found or not available:', detailsHtml.slice(0, 300));
          result = { success: false, error: 'SIM not found or not available for activation', action: 'activate_sim', debug: detailsHtml.slice(0, 200) };
          break;
        }

        // Step 2: Parse ALL form fields (product ID, phone_id, sim_card, account_name, etc.)
        const formFields = parseFormFields(detailsHtml);
        console.log(`[activate_sim] Parsed form fields: product=${formFields.product}, phone_id=${formFields.phone_id}, command=${formFields.command}`);

        // Step 3: Submit to dynamic/submit.php
        const startDate = normalizeDate(params.start_rental || '');
        const endDate   = normalizeDate(params.end_rental   || '');

        const submitRes = await session.post('dynamic/submit.php', {
          ...formFields,
          start_rental: startDate,
          end_rental:   endDate,
          deler4cus_price: params.price || '',
          note: params.note || '',
        });
        const submitHtml = await submitRes.text();
        const errored = hasError(submitHtml);

        if (errored) {
          console.error('[activate_sim] CellStation error:', submitHtml.slice(0, 300));
        } else {
          console.log('[activate_sim] Activation successful');
        }

        result = {
          success: !errored,
          action: 'activate_sim',
          hasError: errored,
          error: errored ? submitHtml.slice(0, 300) : undefined,
        };
        break;
      }

      // ── swap_sim ──────────────────────────────────────────────────────
      // Correct flow:
      //   1. GET BH index page → find active rental by old SIM's ICCID → extract order_id
      //   2. GET rental details page → extract phone_id and other required swap fields
      //   3. POST JSON to content/dashboard/rentals/sim_swap.php
      case 'swap_sim': {
        const { swap_iccid, current_iccid, current_sim, swap_msisdn } = params;

        if (!swap_iccid || swap_iccid.length < 19 || swap_iccid.length > 20) {
          result = { success: false, error: 'New ICCID must be 19-20 digits', action: 'swap_sim' };
          break;
        }
        if (!current_iccid) {
          result = { success: false, error: 'current_iccid is required to find the rental on CellStation', action: 'swap_sim' };
          break;
        }

        // Step 1: GET BH index to find the active rental with old ICCID
        console.log(`[swap_sim] Looking for rental with old ICCID: ${current_iccid}`);
        const bhRes = await session.get('index.php?page=bh/index');
        const bhHtml = await bhRes.text();

        const orderId = findOrderIdByIccid(bhHtml, current_iccid);
        if (!orderId) {
          console.error('[swap_sim] Could not find active rental for ICCID:', current_iccid);
          result = {
            success: false,
            error: `No active rental found for SIM ${current_iccid} on CellStation. The SIM may not be active yet (try waiting longer after activation) or the ICCID is wrong.`,
            action: 'swap_sim',
          };
          break;
        }
        console.log(`[swap_sim] Found rental order_id: ${orderId}`);

        // Step 2: GET rental details to extract swap fields
        const rentalRes = await session.get(`index.php?page=/dashboard/rentals/rental_details&id=${orderId}`);
        const rentalHtml = await rentalRes.text();

        const phoneId      = getValueById(rentalHtml, 'phone_id');
        const accountName  = getValueById(rentalHtml, 'account_name_swap') || current_sim || '';
        const orderIdSwap  = getValueById(rentalHtml, 'order_id_swap')     || orderId;
        const cNu          = getValueById(rentalHtml, 'c_nu_swap')          || '4100';
        const storeId      = getValueById(rentalHtml, 'store_id_swap')      || '5059';

        if (!phoneId) {
          console.error('[swap_sim] Could not extract phone_id from rental details page');
          result = {
            success: false,
            error: 'Could not get phone_id from CellStation rental details',
            action: 'swap_sim',
            debug: rentalHtml.slice(0, 300),
          };
          break;
        }
        console.log(`[swap_sim] phone_id=${phoneId}, account_name=${accountName}, order_id=${orderIdSwap}`);

        // Step 3: POST JSON to sim_swap.php
        const swapRes = await session.postJson('content/dashboard/rentals/sim_swap.php', {
          msisdn:       swap_msisdn || '',  // old SIM's UK number (current rental MSISDN)
          iccid:        swap_iccid,         // new SIM's ICCID
          phone_id:     phoneId,
          account_name: accountName,
          order_id:     orderIdSwap,
          c_nu:         cNu,
          store_id:     storeId,
        });

        const swapText = await swapRes.text();
        let swapData;
        try {
          swapData = JSON.parse(swapText);
        } catch {
          console.error('[swap_sim] Non-JSON response:', swapText.slice(0, 300));
          swapData = { success: false, message: swapText.slice(0, 200) };
        }

        console.log(`[swap_sim] Result: success=${swapData.success}, message=${swapData.message}`);
        result = {
          success: !!swapData.success,
          action: 'swap_sim',
          message: swapData.message || '',
          error: swapData.success ? undefined : (swapData.message || 'Swap failed'),
        };
        break;
      }

      // ── activate_and_swap ─────────────────────────────────────────────
      // Step 1: Activate new SIM (fetch form → submit to dynamic/submit.php)
      // Step 2: Wait 20s for CellStation to process
      // Step 3: Refresh BH index page (required before swap)
      // Step 4: Return ready_to_swap — frontend then calls swap_sim
      case 'activate_and_swap': {
        const newIccid = params.swap_iccid || params.iccid || '';
        if (!newIccid || newIccid.length < 19 || newIccid.length > 20 || !/^\d+$/.test(newIccid)) {
          result = { success: false, error: 'Invalid new ICCID', action: 'activate_and_swap' };
          break;
        }

        // Step 1: Fetch activation form for the new SIM
        console.log(`[activate_and_swap] Step 1: Fetching activation form for new SIM ${newIccid}`);
        const detailsRes = await session.get(`content/dashboard/rentals/fetch_BHsim_details.php?zehut=${newIccid}`);
        const detailsHtml = await detailsRes.text();

        if (!detailsHtml.includes('FormSubmit') || !detailsHtml.includes('name="product"')) {
          console.error('[activate_and_swap] SIM not found:', detailsHtml.slice(0, 200));
          result = {
            success: false,
            action: 'activate_and_swap',
            step: 'activation',
            error: 'New SIM not found or not available for activation',
            debug: detailsHtml.slice(0, 200),
          };
          break;
        }

        const formFields = parseFormFields(detailsHtml);
        console.log(`[activate_and_swap] Activation form: product=${formFields.product}, phone_id=${formFields.phone_id}`);

        const startAS = normalizeDate(params.start_rental || '');
        const endAS   = normalizeDate(params.end_rental   || '');

        const actRes = await session.post('dynamic/submit.php', {
          ...formFields,
          start_rental: startAS,
          end_rental:   endAS,
          deler4cus_price: params.price || '',
          note: params.note || '',
        });
        const actHtml = await actRes.text();

        if (hasError(actHtml)) {
          console.error('[activate_and_swap] Activation error from CellStation:', actHtml.slice(0, 200));
          result = {
            success: false,
            action: 'activate_and_swap',
            step: 'activation',
            error: 'CellStation error during activation',
            debug: actHtml.slice(0, 300),
          };
          break;
        }
        console.log('[activate_and_swap] Activation submitted successfully');

        // Step 2: Wait 20s for CellStation portal to process the activation
        console.log('[activate_and_swap] Step 2: Waiting 20s for portal to process...');
        await new Promise(r => setTimeout(r, 20000));

        // Step 3: Refresh the BH index page (required before swap can find the new rental)
        console.log('[activate_and_swap] Step 3: Refreshing CellStation BH index...');
        await session.get('index.php?page=bh/index');

        result = {
          success: true,
          action: 'activate_and_swap',
          status: 'ready_to_swap',
          message: 'New SIM activated. CellStation portal refreshed. Ready to swap.',
          newIccid,
        };
        break;
      }

      default:
        result = {
          success: false,
          error: `Unknown action: ${action}`,
          available: ['get_sims', 'sync_csv', 'activate_sim', 'swap_sim', 'activate_and_swap', 'check_sim_status'],
        };
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}

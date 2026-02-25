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
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Try all combinations of attribute order and quote style
  // Note: [^>]* matches any char except > (including \n) so multi-line attrs work
  const patterns = [
    new RegExp(`<input[^>]*\\bvalue="([^"]*)"[^>]*\\bid="${esc}"[^>]*>`, 'i'),
    new RegExp(`<input[^>]*\\bid="${esc}"[^>]*\\bvalue="([^"]*)"[^>]*>`, 'i'),
    new RegExp(`<input[^>]*\\bvalue='([^']*)'[^>]*\\bid="${esc}"[^>]*>`, 'i'),
    new RegExp(`<input[^>]*\\bid="${esc}"[^>]*\\bvalue='([^']*)'[^>]*>`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
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
// Scans the BH index HTML for the active rentals table.
// Uses three strategies in order:
//   A) Find the enclosing <tr>...</tr> containing the ICCID and search inside it
//   B) Wide 3000-char window around the ICCID occurrence
//   C) Reverse-scan: collect all rental_details links and check if ICCID is near each one
function findOrderIdByIccid(bhHtml, iccid) {
  if (!iccid) return null;
  const cleanIccid = iccid.replace(/\D/g, '');
  const searchTerms = [...new Set([iccid, cleanIccid].filter(Boolean))];

  for (const term of searchTerms) {
    const idx = bhHtml.indexOf(term);
    if (idx === -1) continue;

    // Strategy A: Find enclosing <tr>...</tr> and look for rental_details inside
    const trStart = bhHtml.lastIndexOf('<tr', idx);
    const trEnd   = bhHtml.indexOf('</tr>', idx);
    if (trStart !== -1 && trEnd !== -1 && (trEnd - trStart) < 10000) {
      const rowHtml = bhHtml.substring(trStart, trEnd + 5);
      const m = rowHtml.match(/rental_details[^"'<]*id=(\d+)/i);
      if (m) {
        console.log(`[findOrderIdByIccid] Strategy A (TR): found order_id=${m[1]} for iccid=${term}`);
        return m[1];
      }
    }

    // Strategy B: Wide 3000-char window
    const chunk = bhHtml.substring(Math.max(0, idx - 3000), Math.min(bhHtml.length, idx + 3000));
    const m2 = chunk.match(/rental_details[^"'<]*id=(\d+)/i);
    if (m2) {
      console.log(`[findOrderIdByIccid] Strategy B (window): found order_id=${m2[1]} for iccid=${term}`);
      return m2[1];
    }
  }

  // Strategy C: Collect all rental_details links and check if ICCID is anywhere nearby
  const linkRe = /rental_details[^"'<]*id=(\d+)/gi;
  let lm;
  while ((lm = linkRe.exec(bhHtml)) !== null) {
    const chunk = bhHtml.substring(
      Math.max(0, lm.index - 4000),
      Math.min(bhHtml.length, lm.index + 4000)
    );
    if (searchTerms.some(t => chunk.includes(t))) {
      console.log(`[findOrderIdByIccid] Strategy C (reverse scan): found order_id=${lm[1]}`);
      return lm[1];
    }
  }

  console.log(`[findOrderIdByIccid] NOT FOUND. Searched for: ${searchTerms.join(', ')}`);
  return null;
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

        // Portal returns "הזמנת ההפעלה נשמרה בהצלחה" on success — require it
        const activated = submitHtml.includes('הזמנת ההפעלה נשמרה בהצלחה');
        const errored   = hasError(submitHtml) || !activated;
        console.log(`[activate_sim] activated=${activated}, hasError=${hasError(submitHtml)}, response: ${submitHtml.slice(0, 300)}`);

        result = {
          success: !errored,
          action: 'activate_sim',
          error: errored
            ? (hasError(submitHtml) ? submitHtml.slice(0, 300) : `לא התקבל אישור הפעלה מ-CellStation. תגובה: ${submitHtml.slice(0, 200)}`)
            : undefined,
        };
        break;
      }

      // ── swap_sim ──────────────────────────────────────────────────────
      // Correct flow:
      //   1. GET BH index page → find active rental by old SIM account/msisdn → extract order_id
      //   2. GET rental details page → extract phone_id and other required swap fields
      //   3. POST JSON to content/dashboard/rentals/sim_swap.php
      //
      // IMPORTANT: The BH index typically does NOT show the ICCID column in its table.
      // Therefore we cannot rely on ICCID appearing in the HTML to confirm a match.
      // Instead: when we do a filtered search (by account name or msisdn) and get back
      // ANY rental_details link, we treat it as the correct rental.
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

        const cleanOldIccid = current_iccid.replace(/\D/g, '');
        console.log(`[swap_sim] Finding rental: ICCID=${current_iccid}, account="${current_sim}", msisdn="${swap_msisdn}"`);

        // Helper: extract first rental_details link from a page (filtered search results)
        const extractFirstOrderId = (html) => {
          const m = html.match(/rental_details[^"'<]*id=(\d+)/i);
          return m ? m[1] : null;
        };

        let orderId = null;
        let bhHtml = '';

        // ── Attempt A: POST search by account name (sim_number) ──────────────
        if (current_sim && !orderId) {
          const sRes = await session.post('index.php?page=bh/index', { sim_lookup_search: current_sim });
          const sHtml = await sRes.text();
          const hasRentals = sHtml.includes('rental_details');
          const iccidVisible = sHtml.includes(current_iccid) || sHtml.includes(cleanOldIccid);
          console.log(`[swap_sim] Search by account "${current_sim}": hasRentals=${hasRentals}, iccidVisible=${iccidVisible}, len=${sHtml.length}`);

          if (hasRentals) {
            // Try ICCID-precise match first, then fall back to first result
            // (BH index often doesn't show ICCID column, so iccidVisible may be false even for correct rental)
            const precise = findOrderIdByIccid(sHtml, current_iccid);
            if (precise) {
              orderId = precise;
              console.log(`[swap_sim] A: ICCID-precise match → orderId=${orderId}`);
            } else {
              orderId = extractFirstOrderId(sHtml);
              console.log(`[swap_sim] A: first rental from account search (ICCID not in index) → orderId=${orderId}`);
            }
            if (orderId) bhHtml = sHtml;
          }
        }

        // ── Attempt B: POST search by UK number (msisdn) ─────────────────────
        if (!orderId && swap_msisdn) {
          const sRes2 = await session.post('index.php?page=bh/index', { sim_lookup_search: swap_msisdn });
          const sHtml2 = await sRes2.text();
          const hasRentals2 = sHtml2.includes('rental_details');
          const iccidVisible2 = sHtml2.includes(current_iccid) || sHtml2.includes(cleanOldIccid);
          console.log(`[swap_sim] Search by msisdn "${swap_msisdn}": hasRentals=${hasRentals2}, iccidVisible=${iccidVisible2}, len=${sHtml2.length}`);

          if (hasRentals2) {
            const precise2 = findOrderIdByIccid(sHtml2, current_iccid);
            if (precise2) {
              orderId = precise2;
              console.log(`[swap_sim] B: ICCID-precise match → orderId=${orderId}`);
            } else {
              orderId = extractFirstOrderId(sHtml2);
              console.log(`[swap_sim] B: first rental from msisdn search → orderId=${orderId}`);
            }
            if (orderId) bhHtml = sHtml2;
          }
        }

        // ── Attempt C: Full BH index GET — search by ICCID, account name, msisdn ──
        if (!orderId) {
          console.log('[swap_sim] A+B failed — fetching full BH index...');
          const bhRes = await session.get('index.php?page=bh/index');
          bhHtml = await bhRes.text();

          // Try ICCID (precise)
          orderId = findOrderIdByIccid(bhHtml, current_iccid);
          if (orderId) {
            console.log(`[swap_sim] C: ICCID match in full index → orderId=${orderId}`);
          }

          // Try account name proximity match
          if (!orderId && current_sim) {
            const idx = bhHtml.indexOf(current_sim);
            if (idx !== -1) {
              const chunk = bhHtml.substring(Math.max(0, idx - 2000), Math.min(bhHtml.length, idx + 2000));
              const m = chunk.match(/rental_details[^"'<]*id=(\d+)/i);
              if (m) {
                orderId = m[1];
                console.log(`[swap_sim] C: account name proximity in full index → orderId=${orderId}`);
              }
            }
          }

          // Try msisdn proximity match
          if (!orderId && swap_msisdn) {
            const idx2 = bhHtml.indexOf(swap_msisdn);
            if (idx2 !== -1) {
              const chunk2 = bhHtml.substring(Math.max(0, idx2 - 2000), Math.min(bhHtml.length, idx2 + 2000));
              const m2 = chunk2.match(/rental_details[^"'<]*id=(\d+)/i);
              if (m2) {
                orderId = m2[1];
                console.log(`[swap_sim] C: msisdn proximity in full index → orderId=${orderId}`);
              }
            }
          }

          console.log(`[swap_sim] Full index: ICCID_in_html=${bhHtml.includes(current_iccid)||bhHtml.includes(cleanOldIccid)}, account_in_html=${bhHtml.includes(current_sim||'')}, orderId=${orderId}, len=${bhHtml.length}`);
        }

        if (!orderId) {
          console.error('[swap_sim] Could not find rental for ICCID:', current_iccid);
          const debugSnippet = bhHtml.substring(0, 600);
          result = {
            success: false,
            error: `לא נמצאה השכרה פעילה עבור סים ${current_iccid} ב-CellStation. ייתכן שהסים טרם הופעל (נסה שוב עוד מעט), או שה-ICCID שגוי.`,
            action: 'swap_sim',
            debug_account_in_html: bhHtml.includes(current_sim || ''),
            debug_msisdn_in_html: bhHtml.includes(swap_msisdn || ''),
            debug_iccid_in_html: bhHtml.includes(current_iccid) || bhHtml.includes(cleanOldIccid),
            debug_snippet: debugSnippet,
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
          // Log what IDs we CAN find to help diagnose
          const foundIds = ['phone_id','account_name_swap','order_id_swap','c_nu_swap','store_id_swap']
            .map(id => `${id}=${getValueById(rentalHtml, id) ?? 'NOT_FOUND'}`).join(', ');
          console.error('[swap_sim] Field scan:', foundIds);
          result = {
            success: false,
            error: `לא ניתן לחלץ phone_id מפרטי ההשכרה (order_id=${orderId}). ייתכן בעיית הרשאות בדף.`,
            action: 'swap_sim',
            debug_order_id: orderId,
            debug_fields: foundIds,
            debug_html: rentalHtml.slice(0, 400),
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
        console.log(`[swap_sim] sim_swap.php raw response (first 400): ${swapText.slice(0, 400)}`);
        let swapData;
        try {
          swapData = JSON.parse(swapText);
        } catch {
          console.error('[swap_sim] Non-JSON response from sim_swap.php:', swapText.slice(0, 300));
          swapData = { success: false, message: `שגיאה לא ידועה מ-CellStation: ${swapText.slice(0, 150)}` };
        }

        console.log(`[swap_sim] Result: success=${swapData.success}, message=${swapData.message}`);

        // CellStation returns { success: true/false, message: "..." }
        // Treat success=1 or success="true" or success=true all as truthy
        const isSuccess = swapData.success === true || swapData.success === 1 || swapData.success === 'true' || swapData.success === '1';
        result = {
          success: isSuccess,
          action: 'swap_sim',
          message: swapData.message || '',
          error: isSuccess ? undefined : (swapData.message || swapData.error || 'Swap failed on CellStation'),
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

        // Portal returns "הזמנת ההפעלה נשמרה בהצלחה" on success — require it
        const actSucceeded = actHtml.includes('הזמנת ההפעלה נשמרה בהצלחה');
        console.log(`[activate_and_swap] Activation result: succeeded=${actSucceeded}, response: ${actHtml.slice(0, 300)}`);

        if (!actSucceeded) {
          result = {
            success: false,
            action: 'activate_and_swap',
            step: 'activation',
            error: hasError(actHtml)
              ? `CellStation שגיאה בהפעלה: ${actHtml.slice(0, 200)}`
              : `הפעלה לא אושרה על ידי CellStation. תגובה: ${actHtml.slice(0, 200)}`,
            debug: actHtml.slice(0, 300),
          };
          break;
        }
        console.log('[activate_and_swap] Activation confirmed by CellStation ✅');

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

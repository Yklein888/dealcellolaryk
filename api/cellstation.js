import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

// ── CellStation Session ───────────────────────────────────────────────────
class CellStationSession {
  constructor() {
    this.cookies = '';
    this.isLoggedIn = false;
  }

  extractCookies(headers) {
    // headers is a Headers object or plain object
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
      if (!ok) return new Response(text, { status: res.status });
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Cookie': this.cookies,
          'Referer': CELLSTATION_BASE + '/index.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
    }

    // Return a Response-like object with text already read
    return { ok: res.ok, status: res.status, text: async () => text, _text: text };
  }

  async get(path) {
    return this.fetchAuthenticated(CELLSTATION_BASE + '/' + path);
  }

  async post(path, data) {
    return this.fetchAuthenticated(CELLSTATION_BASE + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data).toString(),
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
  const m = (d || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return d;
}

function extractInputFields(html) {
  const fields = {};
  const matches = html.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
  for (const f of matches) {
    const n = f.match(/name=["']([^"']+)["']/);
    const v = f.match(/value=["']([^"']*)["']/);
    if (n) fields[n[1]] = v ? v[1] : '';
  }
  return fields;
}

function extractHiddenFields(html) {
  const fields = {};
  const matches = html.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
  for (const f of matches) {
    const n = f.match(/name=["']([^"']+)["']/);
    const v = f.match(/value=["']([^"']+)["']/);
    if (n) fields[n[1]] = v ? v[1] : '';
  }
  return fields;
}

function hasError(html) {
  return html.includes('שגיאה') || html.includes('alert-danger') || html.includes('error');
}

// ── Main Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS);
    res.end('ok');
    return;
  }

  // Set CORS on all responses
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = req.body; // Vercel parses JSON automatically
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

  // ── Supabase DB client ──────────────────────────────────────────────────
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hlswvjyegirbhoszrqyo.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── DB-only actions (no CellStation login needed) ───────────────────────
  if (action === 'get_sims') {
    const { data, error } = await db.from('cellstation_sims').select('*').order('status').order('expiry_date');
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    res.status(200).json({ success: true, sims: data || [] });
    return;
  }

  if (action === 'update_sim_status') {
    const { iccid, status, status_detail } = params;
    const { error } = await db.from('cellstation_sims').update({ status, status_detail }).eq('iccid', iccid);
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    res.status(200).json({ success: true });
    return;
  }

  if (action === 'upsert_sims') {
    const { records } = params;
    await db.from('cellstation_sims').delete().not('id', 'is', null);
    const { error } = await db.from('cellstation_sims').insert(records);
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    res.status(200).json({ success: true });
    return;
  }

  // ── CellStation portal actions ──────────────────────────────────────────
  const session = new CellStationSession();
  const loggedIn = await session.login();
  if (!loggedIn) {
    res.status(401).json({ success: false, error: 'Login failed' });
    return;
  }

  try {
    let result;

    switch (action) {
      case 'sync_csv': {
        const csvRes = await session.get('content/bh/bh_export_csv.php');
        const csvText = await csvRes.text();
        const rawSims = parseCSV(csvText);
        console.log(`sync_csv: parsed ${rawSims.length} sims`);

        if (rawSims.length > 0) {
          await db.from('cellstation_sims').delete().not('id', 'is', null);
          const now = new Date().toISOString();
          const records = rawSims.filter(s => s.iccid).map(sim => {
            let status = 'available', status_detail = 'unknown';
            if (sim.status_raw) {
              const s = sim.status_raw.trim();
              if (s.startsWith('בשכירות'))             { status = 'rented';    status_detail = 'active';   }
              else if (s.startsWith('זמין - תקין'))     { status = 'available'; status_detail = 'valid';    }
              else if (s.startsWith('זמין - קרוב לפקיעה')) { status = 'available'; status_detail = 'expiring'; }
              else if (s.startsWith('זמין - פג תוקף'))  { status = 'available'; status_detail = 'expired';  }
            }
            const parseDate = d => {
              if (!d) return null;
              const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : d;
            };
            return {
              sim_number: sim.sim_number, uk_number: sim.uk_number,
              il_number: sim.il_number, iccid: sim.iccid,
              status, status_detail, status_raw: sim.status_raw,
              expiry_date: parseDate(sim.expiry_date),
              plan: sim.plan,
              start_date: parseDate(sim.start_date),
              end_date: parseDate(sim.end_date),
              customer_name: sim.note,
              last_sync: now,
            };
          });
          await db.from('cellstation_sims').insert(records);
        }

        result = { success: true, action: 'sync_csv', sims: rawSims, count: rawSims.length };
        break;
      }

      case 'check_sim_status': {
        const checkRes = await session.post('index.php?page=bh/index', { sim_lookup_search: params.sim_number });
        const html = await checkRes.text();
        result = { success: true, action: 'check_sim_status', html_length: html.length, raw_html: html };
        break;
      }

      case 'activate_sim': {
        const iccid = params.iccid || '';
        if (!iccid || iccid.length < 19 || iccid.length > 20 || !/^\d+$/.test(iccid)) {
          result = { success: false, error: 'Invalid ICCID format. Must be 19-20 digits.', action: 'activate_sim' };
          break;
        }

        const startRental = normalizeDate(params.start_rental || '');
        const endRental   = normalizeDate(params.end_rental   || '');

        // Send POST directly to index.php?page=bh/index (without fetch_BHsim_details.php)
        const submitRes = await session.post('index.php?page=bh/index', {
          product: params.product || '',
          start_rental: startRental,
          end_rental: endRental,
          deler4cus_price: params.price || '',
          calculated_days_input: params.days || '',
          note: params.note || '',
        });
        const submitHtml = await submitRes.text();
        const errored = hasError(submitHtml);
        const success = !errored && submitRes.status === 200;

        if (success) {
          await db.from('cellstation_sims').update({ status: 'rented', status_detail: 'active' }).eq('iccid', iccid);
        }

        result = { success, action: 'activate_sim', hasError: errored, error: errored ? submitHtml.slice(0, 500) : undefined };
        break;
      }

      case 'swap_sim': {
        const { swap_iccid, current_iccid, swap_msisdn, current_sim } = params;
        if (!swap_iccid || swap_iccid.length < 19 || swap_iccid.length > 20) {
          result = { success: false, error: 'ICCID must be 19-20 digits' };
          break;
        }

        // Send POST directly to index.php?page=bh/index (without fetch_BHsim_details.php)
        const swapSubmitRes = await session.post('index.php?page=bh/index', {
          current_sim: current_sim || '',
          swap_iccid,
          swap_msisdn: swap_msisdn || '',
        });
        const swapHtml = await swapSubmitRes.text();
        const swapError = hasError(swapHtml);
        const swapSuccess = !swapError && swapSubmitRes.status === 200;

        result = { success: swapSuccess, action: 'swap_sim', hasError: swapError, error: swapError ? swapHtml.slice(0, 500) : undefined };
        break;
      }

      case 'activate_and_swap': {
        const newIccid = params.swap_iccid || params.iccid || '';
        const oldIccid = params.current_iccid || '';

        if (!newIccid || newIccid.length < 19 || newIccid.length > 20 || !/^\d+$/.test(newIccid)) {
          result = { success: false, error: 'Invalid new ICCID', action: 'activate_and_swap' };
          break;
        }
        if (!oldIccid || oldIccid.length < 19 || oldIccid.length > 20) {
          result = { success: false, error: 'Invalid old ICCID', action: 'activate_and_swap' };
          break;
        }

        // Part A: Activate new SIM (POST directly to index.php?page=bh/index)
        console.log(`[activate_and_swap] Activating new SIM ${newIccid}`);
        const startAS = normalizeDate(params.start_rental || '');
        const endAS   = normalizeDate(params.end_rental   || '');

        const actRes = await session.post('index.php?page=bh/index', {
          product: params.product || '',
          start_rental: startAS,
          end_rental: endAS,
          deler4cus_price: params.price || '',
          calculated_days_input: params.days || '',
          note: params.note || '',
        });
        const actHtml = await actRes.text();
        const actSuccess = !hasError(actHtml) && actRes.status === 200;

        if (!actSuccess) {
          result = { success: false, action: 'activate_and_swap', step: 'activation', error: 'Activation failed: ' + actHtml.slice(0, 500) };
          break;
        }

        // Wait 60 seconds for portal processing
        console.log('[activate_and_swap] Activation successful, waiting 60s before swap...');
        await new Promise(r => setTimeout(r, 60000));

        // Part B: Swap old SIM to new ICCID (POST directly to index.php?page=bh/index)
        console.log(`[activate_and_swap] Swapping from ${oldIccid} to ${newIccid}`);
        const swapResAS = await session.post('index.php?page=bh/index', {
          current_sim: params.current_sim || '',
          swap_iccid: newIccid,
          swap_msisdn: params.swap_msisdn || '',
        });
        const swapResultAS = await swapResAS.text();
        const swapSuccessAS = !hasError(swapResultAS) && swapResAS.status === 200;

        if (!swapSuccessAS) {
          result = { success: false, action: 'activate_and_swap', step: 'swap', error: 'Activation OK but swap failed: ' + swapResultAS.slice(0, 500) };
          break;
        }

        console.log('[activate_and_swap] Success!');
        result = { success: true, action: 'activate_and_swap' };
        break;
      }

      default:
        result = { success: false, error: `Unknown action: ${action}`, available: ['get_sims', 'sync_csv', 'activate_sim', 'swap_sim', 'activate_and_swap', 'update_sim_status', 'upsert_sims', 'check_sim_status'] };
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
}

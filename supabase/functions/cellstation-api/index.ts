import { createClient } from "npm:@supabase/supabase-js@2";

// Strip HTML tags and return clean text, max 200 chars
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

// Parse CellStation error from HTML response
function parseCellStationError(html: string): string {
  if (html.includes('Curl error') || html.includes('Could not resolve host')) {
    return 'שגיאת חיבור ל-CellStation. יש לנסות שוב מאוחר יותר.';
  }
  if (html.includes('alert-danger') || html.includes('שגיאה')) {
    const clean = stripHtml(html);
    return clean || 'שגיאה בביצוע הפעולה ב-CellStation';
  }
  return stripHtml(html) || 'שגיאה לא ידועה';
}

const CELLSTATION_BASE = "https://cellstation.co.il/portal";
const SUPABASE_URL = "https://hlswvjyegirbhoszrqyo.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI";

async function sha512(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-512", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

class CellStationSession {
  private cookies: string = "";
  private isLoggedIn: boolean = false;

  async login(): Promise<boolean> {
    try {
      const username = Deno.env.get("CELLSTATION_USERNAME");
      const password = Deno.env.get("CELLSTATION_PASSWORD");
      if (!username || !password) { console.error("Missing CELLSTATION credentials"); return false; }
      const loginPageResponse = await fetch(CELLSTATION_BASE + "/login.php", { redirect: "manual" });
      this.extractCookies(loginPageResponse);
      const hashedPassword = await sha512(password);
      const loginResponse = await fetch(CELLSTATION_BASE + "/process_login.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": this.cookies,
          "Referer": CELLSTATION_BASE + "/login.php",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: new URLSearchParams({ username, p: hashedPassword, password: "" }).toString(),
        redirect: "manual",
      });
      this.extractCookies(loginResponse);
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const redirectUrl = loginResponse.headers.get("location");
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith("http") ? redirectUrl : CELLSTATION_BASE + "/" + redirectUrl;
          const redirectResponse = await fetch(fullUrl, {
            headers: { "Cookie": this.cookies, "User-Agent": "Mozilla/5.0" },
            redirect: "manual",
          });
          this.extractCookies(redirectResponse);
        }
      }
      this.isLoggedIn = true;
      return true;
    } catch (error) { console.error("Login failed:", error); return false; }
  }

  private extractCookies(response: Response): void {
    const raw = response.headers.get("set-cookie");
    if (raw) {
      const parts = raw.split(",").map(c => c.split(";")[0].trim()).filter(Boolean);
      this.cookies = this.cookies ? this.cookies + "; " + parts.join("; ") : parts.join("; ");
    }
  }

  async fetchAuthenticated(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.isLoggedIn) await this.login();
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, "Cookie": this.cookies, "Referer": CELLSTATION_BASE + "/index.php", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const cloned = response.clone();
    const text = await cloned.text();
    const isUnauthorized = text.trim() === 'Unauthorized access' || response.status === 401;
    if (isUnauthorized || text.includes('process_login.php') || (text.includes('login_form') && text.length < 5000)) {
      this.isLoggedIn = false; this.cookies = "";
      const loggedIn = await this.login();
      if (!loggedIn) return response;
      return fetch(url, {
        ...options,
        headers: { ...options.headers, "Cookie": this.cookies, "Referer": CELLSTATION_BASE + "/index.php", "User-Agent": "Mozilla/5.0" },
      });
    }
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  async get(path: string): Promise<Response> {
    return this.fetchAuthenticated(CELLSTATION_BASE + "/" + path);
  }

  async post(path: string, data: Record<string, string>): Promise<Response> {
    return this.fetchAuthenticated(CELLSTATION_BASE + "/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data).toString(),
    });
  }
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const results: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.replace(/"/g, "").trim());
    if (cols.length < 7) continue;
    results.push({
      sim_number: cols[0] || null, uk_number: cols[1] || null, il_number: cols[2] || null,
      iccid: cols[3] || null, status_raw: cols[4] || null, expiry_date: cols[5] || null,
      plan: cols[6] || null, start_date: cols[7] || null, end_date: cols[8] || null, note: cols[9] || null,
    });
  }
  return results;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }); }

    const { action, params } = body;
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let result: any;

    // ── פעולות DB (ללא CellStation login) ──
    if (action === "get_sims") {
      const { data, error } = await db.from("cellstation_sims").select("*").order("status").order("expiry_date");
      if (error) { result = { success: false, error: error.message }; }
      else { result = { success: true, sims: data || [] }; }
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_sim_status") {
      const { iccid, status, status_detail } = params;
      const { error } = await db.from("cellstation_sims").update({ status, status_detail }).eq("iccid", iccid);
      result = error ? { success: false, error: error.message } : { success: true };
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── פעולות שדורשות CellStation login ──
    const session = new CellStationSession();
    const loggedIn = await session.login();
    if (!loggedIn) return new Response(JSON.stringify({ success: false, error: "Login failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });

    switch (action) {
      case "sync_csv": {
        const csvResponse = await session.get("content/bh/bh_export_csv.php");
        const csvText = await csvResponse.text();
        const sims = parseCSV(csvText);
        console.log(`sync_csv: parsed ${sims.length} sims`);

        // שמור ב-DB
        if (sims.length > 0) {
          await db.from("cellstation_sims").delete().not("id", "is", null);
          const now = new Date().toISOString();
          const records = sims.filter(s => s.iccid).map(sim => {
            let status = 'available', status_detail = 'unknown';
            if (sim.status_raw) {
              const s = sim.status_raw.trim();
              if (s.startsWith('בשכירות')) { status = 'rented'; status_detail = 'active'; }
              else if (s.startsWith('זמין - תקין')) { status = 'available'; status_detail = 'valid'; }
              else if (s.startsWith('זמין - קרוב לפקיעה')) { status = 'available'; status_detail = 'expiring'; }
              else if (s.startsWith('זמין - פג תוקף')) { status = 'available'; status_detail = 'expired'; }
            }
            const parseDate = (d: string | null) => {
              if (!d) return null;
              const p = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              return p ? `${p[3]}-${p[2].padStart(2,'0')}-${p[1].padStart(2,'0')}` : d;
            };
            return {
              iccid: sim.iccid, sim_number: sim.sim_number, uk_number: sim.uk_number,
              il_number: sim.il_number, status, status_detail,
              expiry_date: parseDate(sim.expiry_date), plan: sim.plan,
              start_date: parseDate(sim.start_date), end_date: parseDate(sim.end_date),
              customer_name: sim.note?.trim() || null, last_sync: now,
            };
          });
          await db.from("cellstation_sims").insert(records);
        }

        result = { success: true, action: "sync_csv", sims, count: sims.length };
        break;
      }
      case "check_sim_status": {
        const response = await session.post("index.php?page=bh/index", { sim_lookup_search: params.sim_number });
        const html = await response.text();
        result = { success: true, action: "check_sim_status", html_length: html.length, raw_html: html };
        break;
      }
      case "activate_sim": {
        const iccid = params.iccid || params.swap_iccid || "";
        if (!iccid || iccid.length < 19 || iccid.length > 20 || !/^\d+$/.test(iccid)) {
          result = { success: false, error: "Invalid ICCID format. Must be 19-20 digits.", action: "activate_sim" }; break;
        }
        await (await session.get("index.php?page=bh/index")).text();
        const detailsResponse = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccid));
        const detailsHtml = await detailsResponse.text();
        const allInputFields = detailsHtml.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        const discoveredFields: Record<string, string> = {};
        for (const field of allInputFields) {
          const nameMatch = field.match(/name=["']([^"']+)["']/);
          const valueMatch = field.match(/value=["']([^"']*)["']/);
          if (nameMatch) discoveredFields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
        }
        let startRental = params.start_rental || "";
        let endRental = params.end_rental || "";
        const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const startMatch = startRental.match(ddmmyyyyRegex);
        if (startMatch) startRental = `${startMatch[3]}-${startMatch[2].padStart(2,'0')}-${startMatch[1].padStart(2,'0')}`;
        const endMatch = endRental.match(ddmmyyyyRegex);
        if (endMatch) endRental = `${endMatch[3]}-${endMatch[2].padStart(2,'0')}-${endMatch[1].padStart(2,'0')}`;
        await (await session.post("content/dashboard/rentals/calculate_days.php", {
          start_rental: startRental, end_rental: endRental,
          product: discoveredFields['product'] || params.product || "", exp: discoveredFields['exp'] || "",
        })).text();
        const formData: Record<string, string> = {
          ...discoveredFields, start_rental: startRental, end_rental: endRental,
          deler4cus_price: params.price || "", calculated_days_input: params.days || "", note: params.note || "",
        };
        const submitResponse = await session.post("dynamic/submit.php", formData);
        const submitHtml = await submitResponse.text();
        const hasError = submitHtml.includes('שגיאה') || submitHtml.includes('alert-danger') || submitHtml.includes('error');
        const success = !hasError && submitResponse.status === 200;
        if (success) await db.from("cellstation_sims").update({ status: 'rented', status_detail: 'active' }).eq("iccid", iccid);
        result = { success, action: "activate_sim", hasError, error: hasError ? parseCellStationError(submitHtml) : undefined };
        break;
      }
      case "swap_sim": {
        if (!params.swap_iccid || params.swap_iccid.length < 19 || params.swap_iccid.length > 20) {
          result = { success: false, error: "ICCID must be 19-20 digits" }; break;
        }
        await (await session.get("index.php?page=bh/index")).text();
        const swapDetailsResp = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(params.current_iccid || ""));
        const swapDetailsHtml = await swapDetailsResp.text();
        const swapHiddenFields = swapDetailsHtml.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        const swapHiddenVals: Record<string, string> = {};
        for (const field of swapHiddenFields) {
          const n = field.match(/name=["']([^"']+)["']/); const v = field.match(/value=["']([^"']+)["']/);
          if (n) swapHiddenVals[n[1]] = v ? v[1] : "";
        }
        const swapSubmitResp = await session.post("dynamic/submit.php", {
          ...swapHiddenVals, swap_iccid: params.swap_iccid, swap_msisdn: params.swap_msisdn || "", current_sim: params.current_sim || "",
        });
        const swapSubmitHtml = await swapSubmitResp.text();
        const swapHasError = swapSubmitHtml.includes('שגיאה') || swapSubmitHtml.includes('alert-danger');
        const swapSuccess = !swapHasError && swapSubmitResp.status === 200;
        result = { success: swapSuccess, action: "swap_sim", hasError: swapHasError, error: swapHasError ? parseCellStationError(swapSubmitHtml) : undefined };
        break;
      }
      case "activate_and_swap": {
        const iccidAS = params.swap_iccid || params.iccid || "";
        const oldIccid = params.current_iccid || "";
        if (!iccidAS || iccidAS.length < 19 || iccidAS.length > 20 || !/^\d+$/.test(iccidAS)) {
          result = { success: false, error: "Invalid new ICCID format.", action: "activate_and_swap" }; break;
        }
        if (!oldIccid || oldIccid.length < 19 || oldIccid.length > 20) {
          result = { success: false, error: "Invalid old ICCID format.", action: "activate_and_swap" }; break;
        }
        await (await session.get("index.php?page=bh/index")).text();

        // Send POST directly to index.php?page=bh/index (like the old working version)
        let startRentalAS = params.start_rental || "", endRentalAS = params.end_rental || "";
        const ddmmAS = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const smAS = startRentalAS.match(ddmmAS);
        if (smAS) startRentalAS = `${smAS[3]}-${smAS[2].padStart(2,'0')}-${smAS[1].padStart(2,'0')}`;
        const emAS = endRentalAS.match(ddmmAS);
        if (emAS) endRentalAS = `${emAS[3]}-${emAS[2].padStart(2,'0')}-${emAS[1].padStart(2,'0')}`;

        const actSubmit = await session.post("index.php?page=bh/index", {
          product: params.product || "",
          start_rental: startRentalAS,
          end_rental: endRentalAS,
          deler4cus_price: params.price || "",
          note: params.note || "",
        });
        const actResult = await actSubmit.text();
        const actSuccess = !actResult.includes('שגיאה') && !actResult.includes('alert-danger') && actSubmit.status === 200;
        if (!actSuccess) { result = { success: false, action: "activate_and_swap", error: "שגיאה בהפעלה: " + parseCellStationError(actResult) }; break; }
        console.log('activate_and_swap: waiting 20s...');
        await new Promise(r => setTimeout(r, 20000));

        // Swap the SIM
        await (await session.get("index.php?page=bh/index")).text();
        const swapSubmitAS = await session.post("index.php?page=bh/index", {
          current_sim: params.current_sim || "",
          swap_iccid: iccidAS,
          swap_msisdn: params.swap_msisdn || "",
        });
        const swapResultAS = await swapSubmitAS.text();
        const swapSuccessAS = !swapResultAS.includes('שגיאה') && !swapResultAS.includes('alert-danger') && swapSubmitAS.status === 200;
        if (!swapSuccessAS) { result = { success: false, action: "activate_and_swap", error: "שגיאה בהחלפה: " + parseCellStationError(swapResultAS) }; break; }
        result = { success: true, action: "activate_and_swap" };
        break;
      }
      case "get_sims": {
        const SB_URL = "https://hlswvjyegirbhoszrqyo.supabase.co";
        const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI";
        const simsRes = await fetch(`${SB_URL}/rest/v1/cellstation_sims?select=*&order=status.asc&order=expiry_date.asc`, {
          headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        const sims = await simsRes.json();
        result = { success: true, sims: Array.isArray(sims) ? sims : [] };
        break;
      }
      case "update_sim_status": {
        const SB_URL = "https://hlswvjyegirbhoszrqyo.supabase.co";
        const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI";
        const { iccid, status, status_detail } = params;
        const updRes = await fetch(`${SB_URL}/rest/v1/cellstation_sims?iccid=eq.${encodeURIComponent(iccid)}`, {
          method: "PATCH",
          headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ status, status_detail })
        });
        result = { success: updRes.ok };
        break;
      }
      case "upsert_sims": {
        const SB_URL = "https://hlswvjyegirbhoszrqyo.supabase.co";
        const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3d2anllZ2lyYmhvc3pycXlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc5ODgxMCwiZXhwIjoyMDg2Mzc0ODEwfQ.C_0heApIB-wQvh2QM6-BqDakOyRcqiVhexuKAdwUrKI";
        const { records } = params;
        // Delete all then insert
        await fetch(`${SB_URL}/rest/v1/cellstation_sims?id=not.is.null`, {
          method: "DELETE",
          headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        if (records && records.length > 0) {
          await fetch(`${SB_URL}/rest/v1/cellstation_sims`, {
            method: "POST",
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
            body: JSON.stringify(records)
          });
        }
        result = { success: true, count: records?.length || 0 };
        break;
      }
      default:
        result = { success: false, error: "Unknown action: " + action, available: ["get_sims", "sync_csv", "activate_sim", "swap_sim", "activate_and_swap", "update_sim_status"] };
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});


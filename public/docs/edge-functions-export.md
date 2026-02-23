# Edge Functions Export - דיל סלולר

ייצוא מלא של כל ה-Edge Functions מהפרויקט.  
תאריך ייצוא: 2026-02-23

---

## תוכן עניינים

1. [cellstation-api](#1-cellstation-api) - ניהול פורטל CellStation (סנכרון CSV, הפעלה, החלפה)
2. [exchange-rate](#2-exchange-rate) - שער חליפין USD/ILS
3. [generate-calling-instructions](#3-generate-calling-instructions) - יצירת PDF הוראות חיוג
4. [generate-invoice](#4-generate-invoice) - יצירת חשבונית
5. [pelecard-pay](#5-pelecard-pay) - חיוב כרטיס אשראי Pelecard
6. [process-overdue-calls](#6-process-overdue-calls) - שיחות אוטומטיות להשכרות באיחור
7. [process-overdue-charges](#7-process-overdue-charges) - חיובים אוטומטיים להשכרות באיחור
8. [sim-activation-callback](#8-sim-activation-callback) - Callback מהפעלת סים
9. [sim-activation-request](#9-sim-activation-request) - בקשת הפעלת סים
10. [yemot-call](#10-yemot-call) - שליחת שיחה דרך ימות המשיח
11. [yemot-callback](#11-yemot-callback) - Callback מימות המשיח
12. [yemot-sms](#12-yemot-sms) - שליחת SMS דרך ימות המשיח

---

## הגדרות (supabase/config.toml)

```toml
project_id = "qifcynwnxmtoxzpskmmt"

[functions.yemot-callback]
verify_jwt = false

[functions.process-overdue-calls]
verify_jwt = false

[functions.sim-activation-request]
verify_jwt = false

[functions.sim-activation-callback]
verify_jwt = false

[functions.cellstation-api]
verify_jwt = false
```

---

## Secrets נדרשים

| Secret | שימוש |
|--------|-------|
| `CELLSTATION_USERNAME` | שם משתמש לפורטל CellStation |
| `CELLSTATION_PASSWORD` | סיסמה לפורטל CellStation |
| `PELECARD_TERMINAL` | מספר טרמינל Pelecard |
| `PELECARD_USER` | שם משתמש Pelecard |
| `PELECARD_PASSWORD` | סיסמה Pelecard |
| `YEMOT_SYSTEM_NUMBER` | מספר מערכת ימות המשיח |
| `YEMOT_PASSWORD` | סיסמת ימות המשיח |
| `SUPABASE_URL` | כתובת Supabase (אוטומטי) |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח שירות Supabase (אוטומטי) |

---

## 1. cellstation-api

**נתיב:** `supabase/functions/cellstation-api/index.ts`  
**תיאור:** ניהול תקשורת מול פורטל CellStation - סנכרון CSV, הפעלת סימים, החלפה  
**JWT:** `verify_jwt = false`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
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

    // DB-only actions
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

    // CellStation portal actions
    const session = new CellStationSession();
    const loggedIn = await session.login();
    if (!loggedIn) return new Response(JSON.stringify({ success: false, error: "Login failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });

    switch (action) {
      case "sync_csv": {
        const csvResponse = await session.get("content/bh/bh_export_csv.php");
        const csvText = await csvResponse.text();
        const sims = parseCSV(csvText);
        console.log(`sync_csv: parsed ${sims.length} sims`);

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
        result = { success, action: "activate_sim", hasError, error: hasError ? submitHtml.substring(0, 500) : undefined };
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
        result = { success: swapSuccess, action: "swap_sim", hasError: swapHasError, error: swapHasError ? swapSubmitHtml.substring(0, 500) : undefined };
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
        const detailsAS = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccidAS));
        const detailsHtmlAS = await detailsAS.text();
        const allFieldsAS = detailsHtmlAS.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        const discoveredValsAS: Record<string, string> = {};
        for (const field of allFieldsAS) {
          const n = field.match(/name=["']([^"']+)["']/); const v = field.match(/value=["']([^"']*)["']/);
          if (n) discoveredValsAS[n[1]] = v ? v[1] : "";
        }
        let startRentalAS = params.start_rental || "", endRentalAS = params.end_rental || "";
        const ddmmAS = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const smAS = startRentalAS.match(ddmmAS);
        if (smAS) startRentalAS = `${smAS[3]}-${smAS[2].padStart(2,'0')}-${smAS[1].padStart(2,'0')}`;
        const emAS = endRentalAS.match(ddmmAS);
        if (emAS) endRentalAS = `${emAS[3]}-${emAS[2].padStart(2,'0')}-${emAS[1].padStart(2,'0')}`;
        await (await session.post("content/dashboard/rentals/calculate_days.php", {
          start_rental: startRentalAS, end_rental: endRentalAS,
          product: discoveredValsAS['product'] || "", exp: discoveredValsAS['exp'] || "",
        })).text();
        const actSubmit = await session.post("dynamic/submit.php", {
          ...discoveredValsAS, start_rental: startRentalAS, end_rental: endRentalAS,
          deler4cus_price: params.price || "", note: params.note || "",
        });
        const actResult = await actSubmit.text();
        const actSuccess = !actResult.includes('שגיאה') && !actResult.includes('alert-danger') && actSubmit.status === 200;
        if (!actSuccess) { result = { success: false, action: "activate_and_swap", error: "Activation failed: " + actResult.substring(0, 500) }; break; }
        console.log('activate_and_swap: waiting 60s...');
        await new Promise(r => setTimeout(r, 60000));
        await (await session.get("index.php?page=bh/index")).text();
        const swapDetailsAS = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(oldIccid));
        const swapDetailsHtmlAS = await swapDetailsAS.text();
        const swapFieldsAS = swapDetailsHtmlAS.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        const swapValsAS: Record<string, string> = {};
        for (const field of swapFieldsAS) {
          const n = field.match(/name=["']([^"']+)["']/); const v = field.match(/value=["']([^"']+)["']/);
          if (n) swapValsAS[n[1]] = v ? v[1] : "";
        }
        const swapSubmitAS = await session.post("dynamic/submit.php", {
          ...swapValsAS, swap_iccid: iccidAS, swap_msisdn: "", current_sim: params.current_sim || "",
        });
        const swapResultAS = await swapSubmitAS.text();
        const swapSuccessAS = !swapResultAS.includes('שגיאה') && !swapResultAS.includes('alert-danger') && swapSubmitAS.status === 200;
        if (!swapSuccessAS) { result = { success: false, action: "activate_and_swap", error: "Swap failed: " + swapResultAS.substring(0, 500) }; break; }
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
```

> ⚠️ **הערה חשובה:** הקוד הזה מכיל Service Key חשוף של פרויקט ישן (`hlswvjyegirbhoszrqyo`). בגרסת ה-Vercel (`api/cellstation.js`) זה תוקן להשתמש ב-`process.env`.

---

## 2. exchange-rate

**נתיב:** `supabase/functions/exchange-rate/index.ts`  
**תיאור:** שער חליפין USD/ILS מבנק ישראל עם fallback  

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_DURATION = 60 * 60 * 1000;
let cachedRate: { rate: number; timestamp: number } | null = null;

async function fetchExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  try {
    const boiResponse = await fetch(
      "https://www.boi.org.il/PublicApi/GetExchangeRates?asOfDate=" + 
      new Date().toISOString().split("T")[0]
    );
    if (boiResponse.ok) {
      const boiData = await boiResponse.json();
      const usdRate = boiData.exchangeRates?.find((r: { key: string }) => r.key === "USD");
      if (usdRate?.currentExchangeRate) {
        const rate = parseFloat(usdRate.currentExchangeRate);
        cachedRate = { rate, timestamp: Date.now() };
        return rate;
      }
    }
  } catch (boiError) {
    console.log("BOI API failed, trying fallback:", boiError);
  }

  try {
    const floatResponse = await fetch("https://www.floatrates.com/daily/usd.json");
    if (floatResponse.ok) {
      const floatData = await floatResponse.json();
      const ilsRate = floatData.ils?.rate;
      if (ilsRate) {
        const rate = parseFloat(ilsRate);
        cachedRate = { rate, timestamp: Date.now() };
        return rate;
      }
    }
  } catch (floatError) {
    console.log("FloatRates API failed:", floatError);
  }

  return 3.65;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rate = await fetchExchangeRate();
    return new Response(
      JSON.stringify({ success: true, rate, currency: "USD/ILS", timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 3. generate-calling-instructions

**נתיב:** `supabase/functions/generate-calling-instructions/index.ts`  
**תיאור:** יצירת PDF הוראות חיוג עם ברקוד ומספרי טלפון (707 שורות)  
**הערה:** קובץ גדול מאוד - מכיל Code128 barcode generator, PNG creator, ועיבוד PDF. ראה את הקובץ המקורי בפרויקט.

---

## 4. generate-invoice

**נתיב:** `supabase/functions/generate-invoice/index.ts`  
**תיאור:** יצירת חשבונית בDB  

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase configuration");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { customerId, customerName, rentalId, transactionId, amount, currency, description } = await req.json();

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        customer_id: customerId || null,
        customer_name: customerName,
        rental_id: rentalId || null,
        transaction_id: transactionId || null,
        amount,
        currency: currency || "ILS",
        description: description || "חיוב",
        business_name: "דיל סלולר",
        business_id: "201512258",
        status: "issued",
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw new Error(`Failed to create invoice: ${insertError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoice: { id: invoice.id, invoiceNumber: invoice.invoice_number, amount: invoice.amount, currency: invoice.currency, issuedAt: invoice.issued_at },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

## 5. pelecard-pay

**נתיב:** `supabase/functions/pelecard-pay/index.ts`  
**תיאור:** חיוב כרטיס אשראי דרך Pelecard - תומך בטוקן ובפרטי כרטיס  
**Secrets:** `PELECARD_TERMINAL`, `PELECARD_USER`, `PELECARD_PASSWORD`  
**הערה:** קובץ גדול (337 שורות) - ראה את הקובץ המקורי בפרויקט.

---

## 6. process-overdue-calls

**נתיב:** `supabase/functions/process-overdue-calls/index.ts`  
**תיאור:** שיחות אוטומטיות ללקוחות עם השכרות באיחור (276 שורות)  
**JWT:** `verify_jwt = false`  
**Secrets:** `YEMOT_SYSTEM_NUMBER`, `YEMOT_PASSWORD`  
**הערה:** כולל בדיקת שבת/חג ישראלי. ראה את הקובץ המקורי בפרויקט.

---

## 7. process-overdue-charges

**נתיב:** `supabase/functions/process-overdue-charges/index.ts`  
**תיאור:** חיובים אוטומטיים יומיים להשכרות באיחור (292 שורות)  
**הערה:** כולל בדיקת שבת/חג, grace period, וחיוב דרך pelecard-pay. ראה את הקובץ המקורי.

---

## 8. sim-activation-callback

**נתיב:** `supabase/functions/sim-activation-callback/index.ts`  
**תיאור:** מקבל עדכון סטטוס הפעלת סים  
**JWT:** `verify_jwt = false`  

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

const API_KEY = Deno.env.get('SIM_ACTIVATION_API_KEY') || 'sim-activation-secret-key';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { sim_number, success, error_message } = await req.json();

    if (!sim_number) {
      return new Response(JSON.stringify({ error: 'sim_number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: simData, error: fetchError } = await supabase.from('sim_cards').select('activation_status').eq('sim_number', sim_number).single();
    if (fetchError || !simData) {
      return new Response(JSON.stringify({ error: 'SIM not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const updateData: Record<string, unknown> = {
      activation_status: success ? 'activated' : 'failed',
      activation_completed_at: new Date().toISOString(),
    };
    if (success) updateData.is_active = true;
    if (!success && error_message) {
      const { data: currentSim } = await supabase.from('sim_cards').select('notes').eq('sim_number', sim_number).single();
      updateData.notes = `${currentSim?.notes || ''}\n[Activation Failed ${new Date().toLocaleString()}]: ${error_message}`.trim();
    }

    await supabase.from('sim_cards').update(updateData).eq('sim_number', sim_number);

    return new Response(
      JSON.stringify({ success: true, sim_number, new_status: success ? 'activated' : 'failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

## 9. sim-activation-request

**נתיב:** `supabase/functions/sim-activation-request/index.ts`  
**תיאור:** שליחת בקשת הפעלת סים ל-Google Apps Script  
**JWT:** `verify_jwt = false`  

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx7HRL6ythPzBINoQDir2PreXod3FNtQJJwfrev3z84xQb-84X8-PHPwb1XFzc750j5/exec";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { sim_number, rental_id, customer_id, customer_name, start_date, end_date } = await req.json();

    if (!sim_number) {
      return new Response(JSON.stringify({ error: 'sim_number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let customerName = customer_name || null;
    if (!customerName && customer_id) {
      const { data: customerData } = await supabase.from('customers').select('name').eq('id', customer_id).single();
      customerName = customerData?.name || null;
    }

    await supabase.from('sim_cards').update({
      activation_status: 'pending',
      activation_requested_at: new Date().toISOString(),
      linked_rental_id: rental_id || null,
      linked_customer_id: customer_id || null,
    }).eq('sim_number', sim_number);

    try {
      const googleResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pending', sim: sim_number, customerName: customerName || '', startDate: start_date || '', endDate: end_date || '' }),
        redirect: 'follow',
      });
      await googleResponse.text();
    } catch (googleError) {
      console.error('Error sending to Google Apps Script:', googleError);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Activation request sent', sim_number }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal server error', details: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

## 10. yemot-call

**נתיב:** `supabase/functions/yemot-call/index.ts`  
**תיאור:** שליחת שיחת TTS דרך ימות המשיח  
**Secrets:** `YEMOT_SYSTEM_NUMBER`, `YEMOT_PASSWORD`  

```typescript
// API: https://www.call2all.co.il/ym/api/RunCampaign
// Params: token={systemNumber}:{password}, phones={cleanPhone}, tts={message}
// Optional: templateId=1267261 (for rental_reminder), caller_id
// Saves call log to call_logs table
```

ראה את הקובץ המקורי בפרויקט (133 שורות).

---

## 11. yemot-callback

**נתיב:** `supabase/functions/yemot-callback/index.ts`  
**תיאור:** מקבל עדכוני סטטוס שיחות מימות המשיח  
**JWT:** `verify_jwt = false`  

```typescript
// Accepts: campaignId, status, phone (via JSON, form data, or query params)
// Maps statuses: answer->answered, noanswer->no_answer, busy->busy, callback->callback
// Updates call_logs table
```

ראה את הקובץ המקורי בפרויקט (130 שורות).

---

## 12. yemot-sms

**נתיב:** `supabase/functions/yemot-sms/index.ts`  
**תיאור:** שליחת SMS דרך ימות המשיח  
**Secrets:** `YEMOT_SYSTEM_NUMBER`, `YEMOT_PASSWORD`  

```typescript
// API: https://www.call2all.co.il/ym/api/SendSms
// Params: token={systemNumber}:{password}, phones={cleanPhone}, message={message}
```

ראה את הקובץ המקורי בפרויקט (77 שורות).

---

## גרסת Vercel (api/cellstation.js)

גרסה מתוקנת של cellstation-api שרצה כ-Vercel Serverless Function:
- משתמשת ב-`process.env` במקום credentials חשופים
- Node.js `crypto` במקום `crypto.subtle`
- תומכת ב-`maxDuration: 300` עבור `activate_and_swap`

ראה `api/cellstation.js` בפרויקט.

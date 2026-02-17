import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CELLSTATION_BASE = "https://cellstation.co.il/portal";

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
      if (!username || !password) {
        console.error("Missing CELLSTATION credentials");
        return false;
      }

      const loginPageResponse = await fetch(CELLSTATION_BASE + "/login.php", { redirect: "manual" });
      this.extractCookies(loginPageResponse);
      
      const hashedPassword = await sha512(password);
      
      const loginResponse = await fetch(CELLSTATION_BASE + "/process_login.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": this.cookies,
          "Referer": CELLSTATION_BASE + "/login.php",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: new URLSearchParams({
          username: username,
          p: hashedPassword,
          password: "",
        }).toString(),
        redirect: "manual",
      });
      this.extractCookies(loginResponse);
      
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const redirectUrl = loginResponse.headers.get("location");
        if (redirectUrl) {
          const fullUrl = redirectUrl.startsWith("http") ? redirectUrl : CELLSTATION_BASE + "/" + redirectUrl;
          const redirectResponse = await fetch(fullUrl, {
            headers: {
              "Cookie": this.cookies,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            redirect: "manual",
          });
          this.extractCookies(redirectResponse);
        }
      }
      
      this.isLoggedIn = true;
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
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
      headers: {
        ...options.headers,
        "Cookie": this.cookies,
        "Referer": CELLSTATION_BASE + "/index.php",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const cloned = response.clone();
    const text = await cloned.text();
    const isUnauthorized = text.trim() === 'Unauthorized access' || response.status === 401;
    if (isUnauthorized || text.includes('process_login.php') || (text.includes('login_form') && text.length < 5000)) {
      console.log('Session expired - re-authenticating...');
      this.isLoggedIn = false;
      this.cookies = "";
      const loggedIn = await this.login();
      if (!loggedIn) {
        console.error('Re-authentication failed');
        return response;
      }
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "Cookie": this.cookies,
          "Referer": CELLSTATION_BASE + "/index.php",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
    }
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  getCookies(): string {
    return this.cookies;
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

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON in request body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }
    const { action, params } = body;
    const session = new CellStationSession();
    const loggedIn = await session.login();
    if (!loggedIn) {
      return new Response(JSON.stringify({ success: false, error: "Login failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    let result: any;

    switch (action) {
      case "sync_csv": {
        const csvResponse = await session.get("content/bh/bh_export_csv.php");
        const csvText = await csvResponse.text();
        const sims = parseCSV(csvText);
        console.log(`sync_csv: parsed ${sims.length} sims`);
        result = { success: true, action: "sync_csv", sims, count: sims.length };
        break;
      }
      case "check_sim_status": {
        const response = await session.post("index.php?page=bh/index", {
          sim_lookup_search: params.sim_number,
        });
        const html = await response.text();
        result = { success: true, action: "check_sim_status", html_length: html.length, raw_html: html };
        break;
      }
      case "activate_sim": {
        const iccid = params.iccid || params.swap_iccid || "";
        console.log(`activate_sim: ICCID=${iccid}`);
        
        if (!iccid || iccid.length < 19 || iccid.length > 20 || !/^\d+$/.test(iccid)) {
          result = { success: false, error: "Invalid ICCID format. Must be 19-20 digits.", action: "activate_sim" };
          break;
        }
        
        // Step 1: Visit bh/index for session context
        await (await session.get("index.php?page=bh/index")).text();
        
        // Step 2: Fetch SIM details
        const detailsResponse = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccid));
        const detailsHtml = await detailsResponse.text();
        
        // Extract form fields
        const allInputFields = detailsHtml.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        const discoveredFields: Record<string, string> = {};
        for (const field of allInputFields) {
          const nameMatch = field.match(/name=["']([^"']+)["']/);
          const valueMatch = field.match(/value=["']([^"']*)["']/);
          if (nameMatch) {
            discoveredFields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
          }
        }
        
        // Date normalization
        let startRental = params.start_rental || "";
        let endRental = params.end_rental || "";
        const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const startMatch = startRental.match(ddmmyyyyRegex);
        if (startMatch) {
          startRental = `${startMatch[3]}-${startMatch[2].padStart(2,'0')}-${startMatch[1].padStart(2,'0')}`;
        }
        const endMatch = endRental.match(ddmmyyyyRegex);
        if (endMatch) {
          endRental = `${endMatch[3]}-${endMatch[2].padStart(2,'0')}-${endMatch[1].padStart(2,'0')}`;
        }
        
        // Step 2.5: Call calculate_days.php
        const productForCalc = discoveredFields['product'] || params.product || "";
        const expForCalc = discoveredFields['exp'] || "";
        await (await session.post("content/dashboard/rentals/calculate_days.php", {
          start_rental: startRental,
          end_rental: endRental,
          product: productForCalc,
          exp: expForCalc,
        })).text();
        
        // Step 3: Submit form
        const formData: Record<string, string> = {
          ...discoveredFields,
          start_rental: startRental,
          end_rental: endRental,
          deler4cus_price: params.price || "",
          calculated_days_input: params.days || "",
          note: params.note || "",
        };
        
        const submitResponse = await session.post("dynamic/submit.php", formData);
        const submitHtml = await submitResponse.text();
        
        const hasSuccess = submitHtml.includes('נשמר בהצלחה') || submitHtml.includes('alert-success') || submitHtml.includes('הופעל');
        const hasError = submitHtml.includes('שגיאה') || submitHtml.includes('alert-danger') || submitHtml.includes('error');
        
        const success = !hasError && submitResponse.status === 200;
        console.log(`activate_sim: ${success ? 'SUCCESS' : 'FAILED'}${hasError ? ' - ' + submitHtml.substring(0, 200) : ''}`);

        result = { 
          success, 
          action: "activate_sim", 
          hasSuccess,
          hasError,
          error: hasError ? "Portal returned error: " + submitHtml.substring(0, 500) : undefined,
        };
        break;
      }
      case "swap_sim": {
        if (!params.swap_iccid || params.swap_iccid.length < 19 || params.swap_iccid.length > 20) {
          result = { success: false, error: "ICCID must be 19-20 digits" };
          break;
        }
        console.log(`swap_sim: current=${params.current_iccid}, new=${params.swap_iccid}`);
        
        // Step 1: Visit bh/index
        await (await session.get("index.php?page=bh/index")).text();
        
        // Step 2: Fetch current SIM details
        const currentIccid = params.current_iccid || "";
        const swapDetailsResp = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(currentIccid));
        const swapDetailsHtml = await swapDetailsResp.text();
        
        // Extract hidden fields
        const swapHiddenFields = swapDetailsHtml.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        const swapHiddenVals: Record<string, string> = {};
        for (const field of swapHiddenFields) {
          const n = field.match(/name=["']([^"']+)["']/);
          const v = field.match(/value=["']([^"']+)["']/);
          if (n) swapHiddenVals[n[1]] = v ? v[1] : "";
        }
        
        // Step 3: Submit swap
        const swapFormData: Record<string, string> = {
          ...swapHiddenVals,
          swap_iccid: params.swap_iccid,
          swap_msisdn: params.swap_msisdn || "",
          current_sim: params.current_sim || "",
        };
        
        const swapSubmitResp = await session.post("dynamic/submit.php", swapFormData);
        const swapSubmitHtml = await swapSubmitResp.text();
        
        const swapHasSuccess = swapSubmitHtml.includes('נשמר בהצלחה') || swapSubmitHtml.includes('alert-success') || swapSubmitHtml.includes('הוחלף') || swapSubmitHtml.includes('success');
        const swapHasError = swapSubmitHtml.includes('שגיאה') || swapSubmitHtml.includes('alert-danger') || swapSubmitHtml.includes('error');
        
        const swapSuccess = !swapHasError && swapSubmitResp.status === 200;
        console.log(`swap_sim: ${swapSuccess ? 'SUCCESS' : 'FAILED'}${swapHasError ? ' - ' + swapSubmitHtml.substring(0, 200) : ''}`);
        
        result = { 
          success: swapSuccess, 
          action: "swap_sim",
          hasSuccess: swapHasSuccess,
          hasError: swapHasError,
          error: swapHasError ? "Portal returned error: " + swapSubmitHtml.substring(0, 500) : undefined,
        };
        break;
      }
      case "activate_and_swap": {
        const iccidAS = params.swap_iccid || params.iccid || "";
        const oldIccid = params.current_iccid || "";
        console.log(`activate_and_swap: newICCID=${iccidAS}, oldICCID=${oldIccid}`);
        
        if (!iccidAS || iccidAS.length < 19 || iccidAS.length > 20 || !/^\d+$/.test(iccidAS)) {
          result = { success: false, error: "Invalid new ICCID format. Must be 19-20 digits.", action: "activate_and_swap" };
          break;
        }
        if (!oldIccid || oldIccid.length < 19 || oldIccid.length > 20) {
          result = { success: false, error: "Invalid old ICCID format. Must be 19-20 digits.", action: "activate_and_swap" };
          break;
        }
        
        // Step 1: Visit bh/index
        await (await session.get("index.php?page=bh/index")).text();
        
        // Step 2: Fetch NEW SIM details for activation
        const detailsAS = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccidAS));
        const detailsHtmlAS = await detailsAS.text();
        
        const allFieldsAS = detailsHtmlAS.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        const discoveredValsAS: Record<string, string> = {};
        for (const field of allFieldsAS) {
          const n = field.match(/name=["']([^"']+)["']/);
          const v = field.match(/value=["']([^"']*)["']/);
          if (n) discoveredValsAS[n[1]] = v ? v[1] : "";
        }
        
        // Date normalization
        let startRentalAS = params.start_rental || "";
        let endRentalAS = params.end_rental || "";
        const ddmmAS = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const smAS = startRentalAS.match(ddmmAS);
        if (smAS) startRentalAS = `${smAS[3]}-${smAS[2].padStart(2,'0')}-${smAS[1].padStart(2,'0')}`;
        const emAS = endRentalAS.match(ddmmAS);
        if (emAS) endRentalAS = `${emAS[3]}-${emAS[2].padStart(2,'0')}-${emAS[1].padStart(2,'0')}`;
        
        // Step 2.5: Call calculate_days.php
        const productAS = discoveredValsAS['product'] || params.product || "";
        const expAS = discoveredValsAS['exp'] || "";
        await (await session.post("content/dashboard/rentals/calculate_days.php", {
          start_rental: startRentalAS,
          end_rental: endRentalAS,
          product: productAS,
          exp: expAS,
        })).text();
        
        // Step 3: Submit activation of new SIM
        const actFormData: Record<string, string> = {
          ...discoveredValsAS,
          start_rental: startRentalAS,
          end_rental: endRentalAS,
          deler4cus_price: params.price || "",
          note: params.note || "",
        };
        
        const actSubmit = await session.post("dynamic/submit.php", actFormData);
        const actResult = await actSubmit.text();
        const actSuccess = !actResult.includes('שגיאה') && !actResult.includes('alert-danger') && actSubmit.status === 200;
        console.log(`activate_and_swap activation: ${actSuccess ? 'SUCCESS' : 'FAILED'}`);
        
        if (!actSuccess) {
          result = { success: false, action: "activate_and_swap", error: "Activation failed: " + actResult.substring(0, 500) };
          break;
        }
        
        // Wait 60 seconds for portal processing
        console.log('Waiting 60 seconds for portal processing...');
        await new Promise(r => setTimeout(r, 60000));
        
        // Step 4: Swap - fetch OLD SIM details and submit swap to new ICCID
        await (await session.get("index.php?page=bh/index")).text();
        
        const swapDetailsAS = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(oldIccid));
        const swapDetailsHtmlAS = await swapDetailsAS.text();
        
        const swapFieldsAS = swapDetailsHtmlAS.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        const swapValsAS: Record<string, string> = {};
        for (const field of swapFieldsAS) {
          const n = field.match(/name=["']([^"']+)["']/);
          const v = field.match(/value=["']([^"']+)["']/);
          if (n) swapValsAS[n[1]] = v ? v[1] : "";
        }
        
        const swapFormAS: Record<string, string> = {
          ...swapValsAS,
          swap_iccid: iccidAS,
          swap_msisdn: "",
          current_sim: params.current_sim || "",
        };
        
        const swapSubmitAS = await session.post("dynamic/submit.php", swapFormAS);
        const swapResultAS = await swapSubmitAS.text();
        const swapSuccessAS = !swapResultAS.includes('שגיאה') && !swapResultAS.includes('alert-danger') && swapSubmitAS.status === 200;
        console.log(`activate_and_swap swap: ${swapSuccessAS ? 'SUCCESS' : 'FAILED'}`);
        
        if (!swapSuccessAS) {
          result = { success: false, action: "activate_and_swap", error: "Activation succeeded but swap failed: " + swapResultAS.substring(0, 500) };
          break;
        }
        
        console.log('activate_and_swap: COMPLETED');
        result = { success: true, action: "activate_and_swap" };
        break;
      }
      default:
        result = {
          success: false,
          error: "Unknown action: " + action,
          available: ["sync_csv", "check_sim_status", "activate_sim", "swap_sim", "activate_and_swap"],
        };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

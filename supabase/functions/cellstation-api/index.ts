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

      // Step 1: Get login page to extract cookies and form action
      const loginPageResponse = await fetch(CELLSTATION_BASE + "/login.php", { redirect: "manual" });
      this.extractCookies(loginPageResponse);
      console.log('Login page status:', loginPageResponse.status, 'Cookies after login page:', this.cookies);
      
      const hashedPassword = await sha512(password);
      
      // Step 2: Submit login form
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
      console.log('Login response status:', loginResponse.status, 'Cookies after login:', this.cookies);
      
      // Follow redirect if 302
      if (loginResponse.status === 302 || loginResponse.status === 301) {
        const redirectUrl = loginResponse.headers.get("location");
        console.log('Login redirect to:', redirectUrl);
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
          console.log('Redirect response status:', redirectResponse.status, 'Cookies after redirect:', this.cookies);
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
    // Check if we got redirected to login page or unauthorized
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
      console.log('Re-authentication successful, retrying request...');
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
    // Return a new response with the text we already consumed
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
        console.log('CSV response status:', csvResponse.status);
        console.log('CSV response length:', csvText.length);
        console.log('CSV first 500 chars:', csvText.substring(0, 500));
        console.log('CSV last 200 chars:', csvText.substring(Math.max(0, csvText.length - 200)));
        const sims = parseCSV(csvText);
        console.log('Parsed sims count:', sims.length);
        if (sims.length > 0) {
          console.log('First sim:', JSON.stringify(sims[0]));
        }
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
        const formData: Record<string, string> = {
          product: params.product || "",
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          deler4cus_price: params.price || "",
          calculated_days_input: params.days || "",
          note: params.note || "",
        };
        
        console.log('=== ACTIVATE SIM START ===');
        console.log('Params received:', JSON.stringify(params, null, 2));
        console.log('Form data being sent:', JSON.stringify(formData, null, 2));

        const response = await session.post("index.php?page=bh/index", formData);
        const html = await response.text();
        console.log('Activation response status:', response.status);
        console.log('Activation response length:', html.length);
        
        const htmlNoScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
        
        // Extract all form fields from the page to understand what the portal expects
        const formFields = htmlNoScript.match(/name=["']([^"']+)["']/g);
        console.log('Form fields found on page:', JSON.stringify(formFields));
        
        // Look for select options (product dropdown values)
        const selectOptions = htmlNoScript.match(/<option[^>]*value=["']([^"']*)["'][^>]*>([^<]*)</g);
        console.log('Select options on page:', JSON.stringify(selectOptions?.slice(0, 20)));
        
        // Check for alerts/messages
        const alerts = htmlNoScript.match(/class=["'][^"']*alert[^"']*["'][^>]*>([^<]*)/g);
        console.log('Alert messages:', JSON.stringify(alerts));
        
        // Check for specific Hebrew messages
        const hebrewMessages = ['הופעל בהצלחה', 'נשמר בהצלחה', 'שגיאה', 'alert-success', 'alert-danger', 'alert-warning', 'alert-info'];
        const foundMessages: Record<string, boolean> = {};
        hebrewMessages.forEach(msg => { foundMessages[msg] = htmlNoScript.includes(msg); });
        console.log('Message checks:', JSON.stringify(foundMessages));
        
        // Log more of the response to understand the page structure
        console.log('Response first 1000 chars:', htmlNoScript.substring(0, 1000));
        console.log('Response last 500 chars:', htmlNoScript.substring(Math.max(0, htmlNoScript.length - 500)));
        
        const debugInfo = {
          hasSuccessMessage: foundMessages['הופעל בהצלחה'] || foundMessages['נשמר בהצלחה'] || foundMessages['alert-success'],
          hasErrorMessage: foundMessages['שגיאה'] || foundMessages['alert-danger'],
          hasWarning: foundMessages['alert-warning'],
          hasInfo: foundMessages['alert-info'],
          isLoginPage: htmlNoScript.includes('process_login.php') || htmlNoScript.includes('login_form'),
          responseLength: html.length,
          responseStatus: response.status,
          formFieldsFound: formFields,
          alertsFound: alerts,
          first1000chars: htmlNoScript.substring(0, 1000),
          last500chars: htmlNoScript.substring(Math.max(0, htmlNoScript.length - 500)),
        };
        console.log('=== ACTIVATE SIM END ===');

        result = { 
          success: !debugInfo.isLoginPage, 
          action: "activate_sim", 
          html_length: html.length, 
          debug: debugInfo,
          error: debugInfo.isLoginPage ? "Authentication failed - still on login page" : 
                 debugInfo.hasErrorMessage ? "Portal returned error" : undefined,
        };
        break;
      }
      case "swap_sim": {
        if (!params.swap_iccid || params.swap_iccid.length < 19 || params.swap_iccid.length > 20) {
          result = { success: false, error: "ICCID must be 19-20 digits" };
          break;
        }
        const response = await session.post(
          "index.php?page=/dashboard/rentals/rental_details&id=" + params.rental_id,
          {
            current_sim: params.current_sim || "",
            swap_msisdn: params.swap_msisdn || "",
            swap_iccid: params.swap_iccid,
          }
        );
        const html = await response.text();
        result = { success: true, action: "swap_sim", html_length: html.length };
        break;
      }
      case "activate_and_swap": {
        const actResponse = await session.post("index.php?page=bh/index", {
          product: params.product || "",
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          deler4cus_price: params.price || "",
          note: params.note || "",
        });
        await new Promise(r => setTimeout(r, 60000));
        const swapResponse = await session.post(
          "index.php?page=/dashboard/rentals/rental_details&id=" + params.rental_id,
          {
            current_sim: params.current_sim || "",
            swap_msisdn: params.swap_msisdn || "",
            swap_iccid: params.swap_iccid,
          }
        );
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

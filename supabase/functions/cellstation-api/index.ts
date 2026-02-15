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
        },
        body: new URLSearchParams({
          username: username,
          p: hashedPassword,
          password: "",
        }).toString(),
        redirect: "manual",
      });
      this.extractCookies(loginResponse);
      this.isLoggedIn = loginResponse.status === 302 || loginResponse.status === 301 || loginResponse.status === 200;
      return this.isLoggedIn;
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
    return fetch(url, {
      ...options,
      headers: { ...options.headers, "Cookie": this.cookies, "Referer": CELLSTATION_BASE + "/index.php" },
    });
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
    const { action, params } = await req.json();
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
        const formData = {
          product: params.product || "",
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          deler4cus_price: params.price || "",
          calculated_days_input: params.days || "",
          note: params.note || "",
        };
        
        console.log('=== URL AND FORM DEBUG ===');
        console.log('Target URL:', CELLSTATION_BASE + '/index.php?page=bh/index');
        console.log('Form data object before encoding:', JSON.stringify({
          product: params.product,
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          price: params.price,
          days: params.days,
          note: params.note,
        }, null, 2));
        console.log('Encoded form data:', new URLSearchParams(formData).toString());

        const response = await session.post("index.php?page=bh/index", formData);

        console.log('=== CELL STATION ACTIVATE RESPONSE DEBUG ===');
        console.log('Response status:', response.status);
        console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

        const html = await response.text();
        
        // Strip <script> tags to avoid false positives from JS code
        const htmlNoScript = html.replace(/<script[\s\S]*?<\/script>/gi, '');
        
        const debugInfo = {
          hasSuccessMessage: htmlNoScript.includes('הופעל בהצלחה') || htmlNoScript.includes('activated successfully') || htmlNoScript.includes('נשמר בהצלחה') || htmlNoScript.includes('alert-success'),
          hasErrorMessage: htmlNoScript.includes('שגיאה') || htmlNoScript.includes('alert-danger'),
          isLoginPage: htmlNoScript.includes('התחברות') || htmlNoScript.includes('login'),
          responseLength: html.length,
          first500chars: htmlNoScript.substring(0, 500),
        };
        console.log('Response analysis:', JSON.stringify(debugInfo, null, 2));

        const pageCheck = {
          hasActivationForm: htmlNoScript.includes('form') && htmlNoScript.includes('product'),
          hasExpectedFields: htmlNoScript.includes('start_rental') || htmlNoScript.includes('end_rental'),
          currentPageTitle: htmlNoScript.match(/<title[^>]*>([^<]+)<\/title>/)?.[1] || null,
          isActivationPage: htmlNoScript.includes('activation') || htmlNoScript.includes('הפעלה'),
        };
        console.log('Page validation:', JSON.stringify(pageCheck, null, 2));

        result = { success: true, action: "activate_sim", html_length: html.length, debug: debugInfo, pageCheck };
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

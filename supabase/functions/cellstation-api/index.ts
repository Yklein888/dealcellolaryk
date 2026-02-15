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
      case "discover_activation_page": {
        // Step 1: GET the bh/index page to see the activation form
        console.log('=== DISCOVER ACTIVATION PAGE ===');
        const pageResponse = await session.get("index.php?page=bh/index");
        const pageHtml = await pageResponse.text();
        console.log('Page status:', pageResponse.status);
        console.log('Page length:', pageHtml.length);
        
        // Extract all forms and their actions
        const forms = pageHtml.match(/<form[^>]*>/gi);
        console.log('Forms found:', JSON.stringify(forms));
        
        // Extract all input/select fields with names
        const inputs = pageHtml.match(/<(?:input|select|textarea)[^>]*name=["']([^"']+)["'][^>]*>/gi);
        console.log('Input fields:', JSON.stringify(inputs));
        
        // Extract all buttons
        const buttons = pageHtml.match(/<button[^>]*>([^<]*)<\/button>/gi);
        console.log('Buttons:', JSON.stringify(buttons));
        
        // Extract all links with "bh" in href
        const bhLinks = pageHtml.match(/href=["'][^"']*bh[^"']*["']/gi);
        console.log('BH links:', JSON.stringify(bhLinks));
        
        // Extract all links with "activate" or "הפעל" 
        const activateLinks = pageHtml.match(/(?:activate|הפעל|rental|שכירות)[^<]*/gi);
        console.log('Activation-related text:', JSON.stringify(activateLinks?.slice(0, 20)));
        
        // Log larger chunks of the page
        console.log('Page first 2000 chars:', pageHtml.substring(0, 2000));
        console.log('Page 2000-4000:', pageHtml.substring(2000, 4000));
        console.log('Page 4000-6000:', pageHtml.substring(4000, 6000));
        
        result = { 
          success: true, 
          action: "discover_activation_page",
          page_length: pageHtml.length,
          forms: forms,
          inputs: inputs,
          buttons: buttons,
          bh_links: bhLinks,
        };
        break;
      }
      case "activate_sim": {
        // The portal uses AJAX flow:
        // 1. GET bh/index page (establishes context/session)
        // 2. GET rentals/fetch_BHsim_details.php?zehut=ICCID (loads the activation form)
        // 3. POST dynamic/submit.php with form data (submits the form)
        console.log('=== ACTIVATE SIM START ===');
        console.log('Params received:', JSON.stringify(params, null, 2));
        
        // Step 1: Visit the bh/index page to establish session context
        const bhPage = await session.get("index.php?page=bh/index");
        const bhText = await bhPage.text();
        console.log('Step 1 - BH page loaded, length:', bhText.length);
        
        // Step 2: Fetch SIM details form (this is what fillSearchBox triggers)
        const iccid = params.iccid || params.swap_iccid || "";
        console.log('Step 2 - Fetching SIM details for ICCID:', iccid);
        
        // Validate ICCID format
        if (!iccid || iccid.length < 19 || iccid.length > 20 || !/^\d+$/.test(iccid)) {
          result = { success: false, error: "Invalid ICCID format. Must be 19-20 digits.", action: "activate_sim" };
          break;
        }
        if (!iccid.startsWith('89445300')) {
          console.warn('ICCID does not start with expected prefix 89445300:', iccid);
        }
        
        const detailsResponse = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccid));
        const detailsHtml = await detailsResponse.text();
        console.log('SIM details response status:', detailsResponse.status);
        console.log('SIM details response length:', detailsHtml.length);
        console.log('SIM details HTML:', detailsHtml.substring(0, 3000));
        
        // Extract form fields from the details form
        const detailFields = detailsHtml.match(/name=["']([^"']+)["']/g);
        console.log('Detail form fields:', JSON.stringify(detailFields));
        
        // Extract ALL form fields (hidden and visible) and their values
        const allInputFields = detailsHtml.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        console.log('All input fields count:', allInputFields.length);
        
        // Extract select fields
        const selectFields = detailsHtml.match(/<select[^>]*name=["']([^"']+)["'][^>]*>[\s\S]*?<\/select>/gi);
        console.log('Select fields:', JSON.stringify(selectFields?.slice(0, 5)));
        
        // Check if there's a form with action
        const formMatch = detailsHtml.match(/<form[^>]*(?:action=["']([^"']+)["'])?[^>]*class=["'][^"']*FormSubmit[^"']*["'][^>]*>/i);
        console.log('Form match:', formMatch ? formMatch[0] : 'No FormSubmit form found');
        
        // Build form data from ALL discovered input fields
        const discoveredFields: Record<string, string> = {};
        for (const field of allInputFields) {
          const nameMatch = field.match(/name=["']([^"']+)["']/);
          const valueMatch = field.match(/value=["']([^"']*)["']/);
          if (nameMatch) {
            discoveredFields[nameMatch[1]] = valueMatch ? valueMatch[1] : "";
          }
        }
        console.log('All discovered field values:', JSON.stringify(discoveredFields));
        
        // Step 3: POST to dynamic/submit.php with combined form data
        // Hidden fields already contain: product, country, phone_id, number, account_name, 
        // il_number, sim_card, mor_id, c_nu, store_id, command (243), submitted (1)
        const formData: Record<string, string> = {
          ...discoveredFields,
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          deler4cus_price: params.price || "",
          calculated_days_input: params.days || "",
          note: params.note || "",
        };
        // IMPORTANT: Do NOT override 'product' - the portal expects the numeric ID (e.g. "4")
        // from the form, not the display name (e.g. "10 גיגה גלישה") from our params.
        // Same for 'exp' - use the portal's value unless we have a specific override reason.
        // Do NOT override: product, exp, country, phone_id, number, account_name, 
        // il_number, sim_card, mor_id, c_nu, store_id, command, submitted
        console.log('Step 3 - Submitting to dynamic/submit.php with data:', JSON.stringify(formData, null, 2));
        
        const submitResponse = await session.post("dynamic/submit.php", formData);
        const submitHtml = await submitResponse.text();
        console.log('Submit response status:', submitResponse.status);
        console.log('Submit response length:', submitHtml.length);
        console.log('Submit response:', submitHtml.substring(0, 2000));
        
        const hasSuccess = submitHtml.includes('נשמר בהצלחה') || submitHtml.includes('alert-success') || submitHtml.includes('הופעל');
        const hasError = submitHtml.includes('שגיאה') || submitHtml.includes('alert-danger') || submitHtml.includes('error');
        
        console.log('=== ACTIVATE SIM END ===');
        console.log('Success:', hasSuccess, 'Error:', hasError);

        result = { 
          success: !hasError && submitResponse.status === 200, 
          action: "activate_sim", 
          debug: {
            discoveredFields,
            formDataSent: formData,
            submitResponsePreview: submitHtml.substring(0, 1000),
            hasSuccess,
            hasError,
          },
          error: hasError ? "Portal returned error: " + submitHtml.substring(0, 500) : undefined,
        };
        break;
      }
      case "swap_sim": {
        if (!params.swap_iccid || params.swap_iccid.length < 19 || params.swap_iccid.length > 20) {
          result = { success: false, error: "ICCID must be 19-20 digits" };
          break;
        }
        console.log('=== SWAP SIM START ===');
        console.log('Params:', JSON.stringify(params));
        
        // Step 1: Visit bh/index to establish session context
        const swapBhPage = await session.get("index.php?page=bh/index");
        await swapBhPage.text();
        console.log('Step 1 - BH page loaded');
        
        // Step 2: Fetch current SIM details to get the swap form
        const currentIccid = params.current_iccid || "";
        console.log('Step 2 - Fetching details for current ICCID:', currentIccid);
        const swapDetailsResp = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(currentIccid));
        const swapDetailsHtml = await swapDetailsResp.text();
        console.log('Swap details response status:', swapDetailsResp.status);
        console.log('Swap details length:', swapDetailsHtml.length);
        console.log('Swap details HTML:', swapDetailsHtml.substring(0, 3000));
        
        // Extract hidden fields
        const swapHiddenFields = swapDetailsHtml.match(/<input[^>]*type=["']hidden["'][^>]*>/gi) || [];
        const swapHiddenVals: Record<string, string> = {};
        for (const field of swapHiddenFields) {
          const n = field.match(/name=["']([^"']+)["']/);
          const v = field.match(/value=["']([^"']+)["']/);
          if (n) swapHiddenVals[n[1]] = v ? v[1] : "";
        }
        console.log('Hidden fields found:', JSON.stringify(swapHiddenVals));
        
        // Look for swap-specific form fields or buttons
        const swapForms = swapDetailsHtml.match(/<form[^>]*>/gi);
        console.log('Forms found:', JSON.stringify(swapForms));
        const swapButtons = swapDetailsHtml.match(/<button[^>]*>[\s\S]*?<\/button>/gi);
        console.log('Buttons found:', JSON.stringify(swapButtons));
        const swapInputFields = swapDetailsHtml.match(/name=["']([^"']+)["']/gi);
        console.log('All named fields:', JSON.stringify(swapInputFields));
        
        // Look for swap-specific text/links 
        const swapRelated = swapDetailsHtml.match(/(?:swap|replace|החלף|החלפ)[^<]*/gi);
        console.log('Swap related text:', JSON.stringify(swapRelated));
        
        // Step 3: Try submitting swap via dynamic/submit.php (same pattern as activation)
        const swapFormData: Record<string, string> = {
          ...swapHiddenVals,
          swap_iccid: params.swap_iccid,
          swap_msisdn: params.swap_msisdn || "",
          current_sim: params.current_sim || "",
        };
        console.log('Step 3 - Submitting swap with data:', JSON.stringify(swapFormData));
        
        const swapSubmitResp = await session.post("dynamic/submit.php", swapFormData);
        const swapSubmitHtml = await swapSubmitResp.text();
        console.log('Swap submit status:', swapSubmitResp.status);
        console.log('Swap submit length:', swapSubmitHtml.length);
        console.log('Swap submit response:', swapSubmitHtml.substring(0, 2000));
        console.log('Swap submit tail:', swapSubmitHtml.substring(Math.max(0, swapSubmitHtml.length - 500)));
        
        const swapHasSuccess = swapSubmitHtml.includes('נשמר בהצלחה') || swapSubmitHtml.includes('alert-success') || swapSubmitHtml.includes('הוחלף') || swapSubmitHtml.includes('success');
        const swapHasError = swapSubmitHtml.includes('שגיאה') || swapSubmitHtml.includes('alert-danger') || swapSubmitHtml.includes('error');
        
        console.log('=== SWAP SIM END ===');
        console.log('Success:', swapHasSuccess, 'Error:', swapHasError);
        
        result = { 
          success: !swapHasError && swapSubmitResp.status === 200, 
          action: "swap_sim",
          debug: {
            hiddenFields: swapHiddenVals,
            formDataSent: swapFormData,
            submitResponsePreview: swapSubmitHtml.substring(0, 1000),
            hasSuccess: swapHasSuccess,
            hasError: swapHasError,
          },
          error: swapHasError ? "Portal returned error: " + swapSubmitHtml.substring(0, 500) : undefined,
        };
        break;
      }
      case "activate_and_swap": {
        // Same AJAX flow as activate_sim
        console.log('=== ACTIVATE AND SWAP START ===');
        
        // Step 1: Visit bh/index
        const bhPageAS = await session.get("index.php?page=bh/index");
        await bhPageAS.text();
        
        // Step 2: Fetch SIM details
        const iccidAS = params.iccid || params.swap_iccid || "";
        if (!iccidAS || iccidAS.length < 19 || iccidAS.length > 20 || !/^\d+$/.test(iccidAS)) {
          result = { success: false, error: "Invalid ICCID format. Must be 19-20 digits.", action: "activate_and_swap" };
          break;
        }
        const detailsAS = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(iccidAS));
        const detailsHtmlAS = await detailsAS.text();
        
        // Parse ALL input fields from the form
        const allFieldsAS = detailsHtmlAS.match(/<input[^>]*name=["'][^"']+["'][^>]*>/gi) || [];
        const discoveredValsAS: Record<string, string> = {};
        for (const field of allFieldsAS) {
          const n = field.match(/name=["']([^"']+)["']/);
          const v = field.match(/value=["']([^"']*)["']/);
          if (n) discoveredValsAS[n[1]] = v ? v[1] : "";
        }
        
        // Step 3: Submit activation
        const actFormData: Record<string, string> = {
          ...discoveredValsAS,
          start_rental: params.start_rental,
          end_rental: params.end_rental,
          deler4cus_price: params.price || "",
          note: params.note || "",
        };
        if (params.product) actFormData.product = params.product;
        
        const actSubmit = await session.post("dynamic/submit.php", actFormData);
        const actResult = await actSubmit.text();
        console.log('Activation submit result:', actResult.substring(0, 500));
        
        // Wait 60 seconds for portal processing
        console.log('Waiting 60 seconds...');
        await new Promise(r => setTimeout(r, 60000));
        
        // Step 4: Swap SIM
        const swapResponse = await session.post(
          "index.php?page=/dashboard/rentals/rental_details&id=" + params.rental_id,
          {
            current_sim: params.current_sim || "",
            swap_msisdn: params.swap_msisdn || "",
            swap_iccid: params.swap_iccid,
          }
        );
        console.log('=== ACTIVATE AND SWAP END ===');
        result = { success: true, action: "activate_and_swap" };
        break;
      }
      case "inspect_activation_page": {
        console.log('=== INSPECT ACTIVATION PAGE ===');
        
        // Try multiple candidate URLs for the activation form
        const pagesToInspect = [
          { name: 'bh/activation', url: 'index.php?page=bh/activation' },
          { name: 'bh/index', url: 'index.php?page=bh/index' },
          { name: 'bh/new_rental', url: 'index.php?page=bh/new_rental' },
          { name: 'rentals/new', url: 'index.php?page=rentals/new' },
        ];
        
        const inspectedPages: any[] = [];
        
        for (const pg of pagesToInspect) {
          try {
            const pgResp = await session.get(pg.url);
            const pgHtml = await pgResp.text();
            console.log(`Page ${pg.name}: status=${pgResp.status}, length=${pgHtml.length}`);
            
            // Extract all forms
            const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
            const pageForms: any[] = [];
            let fMatch;
            while ((fMatch = formRegex.exec(pgHtml)) !== null) {
              const formTag = fMatch[0];
              const actionMatch = formTag.match(/action=["']([^"']*)["']/i);
              const classMatch = formTag.match(/class=["']([^"']*)["']/i);
              const idMatch = formTag.match(/id=["']([^"']*)["']/i);
              const inputs: any[] = [];
              const inputRegex = /<(?:input|select|textarea)[^>]*>/gi;
              let iMatch;
              while ((iMatch = inputRegex.exec(formTag)) !== null) {
                const el = iMatch[0];
                const nameM = el.match(/name=["']([^"']*)["']/i);
                const typeM = el.match(/type=["']([^"']*)["']/i);
                const valueM = el.match(/value=["']([^"']*)["']/i);
                const idM = el.match(/id=["']([^"']*)["']/i);
                if (nameM) {
                  inputs.push({
                    name: nameM[1],
                    type: typeM?.[1] || 'text',
                    value: valueM?.[1] || '',
                    id: idM?.[1] || '',
                  });
                }
              }
              pageForms.push({
                action: actionMatch?.[1] || '',
                class: classMatch?.[1] || '',
                id: idMatch?.[1] || '',
                inputs,
              });
            }
            
            // Extract AJAX/JS calls that load forms dynamically
            const ajaxCalls = pgHtml.match(/(?:fetch|ajax|load|getJSON|\.get|\.post)\s*\([^)]*\)/gi);
            const scriptBlocks = pgHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
            const jsSnippets = scriptBlocks?.map((s: string) => s.substring(0, 500)) || [];
            
            inspectedPages.push({
              name: pg.name,
              url: pg.url,
              status: pgResp.status,
              length: pgHtml.length,
              forms: pageForms,
              ajaxCalls: ajaxCalls?.slice(0, 10) || [],
              jsSnippetCount: scriptBlocks?.length || 0,
              jsSnippets: jsSnippets.slice(0, 5),
              htmlPreview: pgHtml.substring(0, 3000),
            });
          } catch (e) {
            inspectedPages.push({ name: pg.name, url: pg.url, error: String(e) });
          }
        }
        
        // Also inspect the AJAX endpoint that loads activation details
        const testIccid = params?.iccid || '0000000000000000000';
        try {
          const ajaxResp = await session.get("content/dashboard/rentals/fetch_BHsim_details.php?zehut=" + encodeURIComponent(testIccid));
          const ajaxHtml = await ajaxResp.text();
          
          const ajaxFormRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
          const ajaxForms: any[] = [];
          let afMatch;
          while ((afMatch = ajaxFormRegex.exec(ajaxHtml)) !== null) {
            const formTag = afMatch[0];
            const actionMatch = formTag.match(/action=["']([^"']*)["']/i);
            const classMatch = formTag.match(/class=["']([^"']*)["']/i);
            const inputs: any[] = [];
            const inputRegex = /<(?:input|select|textarea)[^>]*>/gi;
            let iMatch;
            while ((iMatch = inputRegex.exec(formTag)) !== null) {
              const el = iMatch[0];
              const nameM = el.match(/name=["']([^"']*)["']/i);
              const typeM = el.match(/type=["']([^"']*)["']/i);
              const valueM = el.match(/value=["']([^"']*)["']/i);
              if (nameM) {
                inputs.push({ name: nameM[1], type: typeM?.[1] || 'text', value: valueM?.[1] || '' });
              }
            }
            ajaxForms.push({ action: actionMatch?.[1] || '', class: classMatch?.[1] || '', inputs });
          }
          
          inspectedPages.push({
            name: 'fetch_BHsim_details (AJAX)',
            url: 'content/rentals/fetch_BHsim_details.php?zehut=' + testIccid,
            status: ajaxResp.status,
            length: ajaxHtml.length,
            forms: ajaxForms,
            htmlFull: ajaxHtml.substring(0, 5000),
          });
        } catch (e) {
          inspectedPages.push({ name: 'fetch_BHsim_details', error: String(e) });
        }
        
        result = { success: true, action: 'inspect_activation_page', pages: inspectedPages };
        break;
      }
      default:
        result = {
          success: false,
          error: "Unknown action: " + action,
          available: ["sync_csv", "check_sim_status", "activate_sim", "swap_sim", "activate_and_swap", "discover_activation_page", "inspect_activation_page"],
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

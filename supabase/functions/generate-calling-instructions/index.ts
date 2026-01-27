import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format phone number from scientific notation to string
const formatPhoneNumber = (num: string | undefined): string => {
  if (!num) return '';
  
  // Check if it's in scientific notation
  if (num.includes('E') || num.includes('e')) {
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) {
      return parsed.toFixed(0);
    }
  }
  
  // Remove any existing dashes or spaces
  return num.replace(/[-\s]/g, '');
};

// Format Israeli number with dashes (e.g., 0722-587-081 or 0553-232-3232)
const formatIsraeliDisplay = (num: string): string => {
  // Remove non-digits
  const digits = num.replace(/\D/g, '');
  
  if (digits.length === 10) {
    // 10 digits: 0722-587-081 format
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 11) {
    // 11 digits: 0553-232-3232 format
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 9) {
    // 9 digits (without leading 0): add 0 and format
    return `0${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return num;
};

// Format international number (e.g., 44-7429629581)
const formatInternationalDisplay = (num: string): string => {
  // Remove non-digits
  const digits = num.replace(/\D/g, '');
  
  if (digits.startsWith('44')) {
    return `44-${digits.slice(2)}`;
  }
  // If it doesn't start with 44, assume it's a UK number and add 44
  if (digits.length >= 10) {
    return `44-${digits}`;
  }
  return num;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { israeliNumber, localNumber, templateUrl } = await req.json();
    
    const formattedIsraeli = formatPhoneNumber(israeliNumber);
    const formattedLocal = formatPhoneNumber(localNumber);
    
    const israeliDisplay = formattedIsraeli ? formatIsraeliDisplay(formattedIsraeli) : '---';
    const localDisplay = formattedLocal ? formatInternationalDisplay(formattedLocal) : '---';

    console.log("Input Israeli:", israeliNumber, "-> Formatted:", israeliDisplay);
    console.log("Input Local:", localNumber, "-> Formatted:", localDisplay);
    console.log("Fetching template from:", templateUrl);

    // Fetch the template
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`Template fetch failed: ${templateResponse.status} ${templateResponse.statusText}`);
    }
    const templateBuffer = await templateResponse.arrayBuffer();
    console.log("Template fetched, size:", templateBuffer.byteLength);

    // Load the DOCX as a zip
    const zip = await JSZip.loadAsync(templateBuffer);
    
    // Get the document.xml content
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      throw new Error("Could not read document.xml from template");
    }
    
    console.log("Original document length:", documentXml.length);

    // Replace the phone numbers in the XML
    // The template has "0722-587-081" as the Israeli number and "44-7429629581" as the local number
    let modifiedXml = documentXml;
    
    // Replace Israeli number placeholder
    modifiedXml = modifiedXml.replace(/0722-587-081/g, israeliDisplay);
    
    // Replace local number placeholder
    modifiedXml = modifiedXml.replace(/44-7429629581/g, localDisplay);
    
    // Log if replacements were made
    const israeliReplaced = documentXml.includes('0722-587-081');
    const localReplaced = documentXml.includes('44-7429629581');
    console.log("Israeli placeholder found:", israeliReplaced, "Local placeholder found:", localReplaced);
    console.log("Final Israeli:", israeliDisplay, "Final Local:", localDisplay);

    // Update the document.xml in the zip
    zip.file("word/document.xml", modifiedXml);

    // Generate the output docx as arraybuffer (works better for Response)
    const output = await zip.generateAsync({
      type: "arraybuffer",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    console.log("Generated document size:", output.byteLength);

    // Return the document
    return new Response(output, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="calling-instructions-${formattedIsraeli || 'sim'}.docx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error generating document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import bwipjs from "https://esm.sh/bwip-js@4.5.1";

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

// Generate barcode as PNG base64
const generateBarcodeBase64 = async (barcodeText: string): Promise<string | null> => {
  try {
    const pngBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: barcodeText,
      scale: 2,
      height: 8,
      includetext: true,
      textxalign: 'center',
      textsize: 8,
    });
    
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pngBuffer)));
    return base64;
  } catch (error) {
    console.error('Error generating barcode:', error);
    return null;
  }
};

// Create XML for barcode image at bottom left of document
const createBarcodeXml = (imageRelId: string): string => {
  // Size: approximately 25mm x 12mm = 950000 x 457200 EMUs (1 mm = 38100 EMUs)
  const width = 950000;
  const height = 457200;
  
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="200" w:after="0"/>
      </w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${width}" cy="${height}"/>
            <wp:docPr id="1" name="Barcode"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="barcode.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${imageRelId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${width}" cy="${height}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  `;
};

// Create XML for the phone numbers header section
// Font size 13 = 26 in Word half-points, aligned left, bold, no spacing before/after
const createPhoneNumbersXml = (israeliDisplay: string, localDisplay: string): string => {
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
        <w:rPr>
          <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="26"/>
          <w:szCs w:val="26"/>
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="26"/>
          <w:szCs w:val="26"/>
        </w:rPr>
        <w:t>מספר ישראלי: ${israeliDisplay}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
        <w:rPr>
          <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="26"/>
          <w:szCs w:val="26"/>
        </w:rPr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="26"/>
          <w:szCs w:val="26"/>
        </w:rPr>
        <w:t>מספר מקומי: ${localDisplay}</w:t>
      </w:r>
    </w:p>
  `;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { israeliNumber, localNumber, templateUrl, barcode } = await req.json();
    
    const formattedIsraeli = formatPhoneNumber(israeliNumber);
    const formattedLocal = formatPhoneNumber(localNumber);
    
    const israeliDisplay = formattedIsraeli ? formatIsraeliDisplay(formattedIsraeli) : '---';
    const localDisplay = formattedLocal ? formatInternationalDisplay(formattedLocal) : '---';

    console.log("Input Israeli:", israeliNumber, "-> Formatted:", israeliDisplay);
    console.log("Input Local:", localNumber, "-> Formatted:", localDisplay);
    console.log("Barcode:", barcode);
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

    // Create the phone numbers XML to insert at the beginning
    const phoneNumbersXml = createPhoneNumbersXml(israeliDisplay, localDisplay);

    // Insert the phone numbers after <w:body> tag
    let modifiedXml = documentXml;
    const bodyTagMatch = modifiedXml.match(/<w:body[^>]*>/);
    
    if (bodyTagMatch) {
      const bodyTagEnd = modifiedXml.indexOf(bodyTagMatch[0]) + bodyTagMatch[0].length;
      modifiedXml = 
        modifiedXml.slice(0, bodyTagEnd) + 
        phoneNumbersXml + 
        modifiedXml.slice(bodyTagEnd);
      console.log("Inserted phone numbers after <w:body> tag");
    } else {
      console.log("Warning: Could not find <w:body> tag");
    }

    // Handle barcode if provided
    if (barcode) {
      console.log("Generating barcode image for:", barcode);
      const barcodeBase64 = await generateBarcodeBase64(barcode);
      
      if (barcodeBase64) {
        // Add the barcode image to the document
        const imageId = "rIdBarcode1";
        
        // Add image to word/media folder
        const barcodeBuffer = Uint8Array.from(atob(barcodeBase64), c => c.charCodeAt(0));
        zip.file("word/media/barcode.png", barcodeBuffer);
        
        // Update [Content_Types].xml to include PNG
        const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
        if (contentTypesXml && !contentTypesXml.includes('Extension="png"')) {
          const updatedContentTypes = contentTypesXml.replace(
            '</Types>',
            '<Default Extension="png" ContentType="image/png"/></Types>'
          );
          zip.file("[Content_Types].xml", updatedContentTypes);
        }
        
        // Update word/_rels/document.xml.rels to include the image relationship
        let relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
        if (relsXml) {
          const newRel = `<Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/barcode.png"/>`;
          relsXml = relsXml.replace('</Relationships>', newRel + '</Relationships>');
          zip.file("word/_rels/document.xml.rels", relsXml);
        }
        
        // Add namespace declarations if missing
        if (!modifiedXml.includes('xmlns:wp=')) {
          modifiedXml = modifiedXml.replace(
            '<w:document',
            '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
          );
        }
        
        // Insert barcode XML before </w:body>
        const barcodeXml = createBarcodeXml(imageId);
        modifiedXml = modifiedXml.replace('</w:body>', barcodeXml + '</w:body>');
        console.log("Inserted barcode image before </w:body>");
      }
    }

    console.log("Modified document length:", modifiedXml.length);

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Code128 character set B encoding table
const CODE128B: Record<string, number> = {
  ' ': 0, '!': 1, '"': 2, '#': 3, '$': 4, '%': 5, '&': 6, "'": 7,
  '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, '/': 15,
  '0': 16, '1': 17, '2': 18, '3': 19, '4': 20, '5': 21, '6': 22, '7': 23,
  '8': 24, '9': 25, ':': 26, ';': 27, '<': 28, '=': 29, '>': 30, '?': 31,
  '@': 32, 'A': 33, 'B': 34, 'C': 35, 'D': 36, 'E': 37, 'F': 38, 'G': 39,
  'H': 40, 'I': 41, 'J': 42, 'K': 43, 'L': 44, 'M': 45, 'N': 46, 'O': 47,
  'P': 48, 'Q': 49, 'R': 50, 'S': 51, 'T': 52, 'U': 53, 'V': 54, 'W': 55,
  'X': 56, 'Y': 57, 'Z': 58, '[': 59, '\\': 60, ']': 61, '^': 62, '_': 63,
  '`': 64, 'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71,
  'h': 72, 'i': 73, 'j': 74, 'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79,
  'p': 80, 'q': 81, 'r': 82, 's': 83, 't': 84, 'u': 85, 'v': 86, 'w': 87,
  'x': 88, 'y': 89, 'z': 90, '{': 91, '|': 92, '}': 93, '~': 94,
};

// Code128 bar patterns (each value represents bars: 1=black, 0=white)
const CODE128_PATTERNS: string[] = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];

const START_B = 104;
const STOP = 106;

// Generate Code128B barcode pattern
function generateCode128Pattern(text: string): string {
  const values: number[] = [START_B];
  
  for (const char of text) {
    const value = CODE128B[char];
    if (value !== undefined) {
      values.push(value);
    }
  }
  
  // Calculate checksum
  let checksum = values[0];
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  checksum = checksum % 103;
  values.push(checksum);
  values.push(STOP);
  
  // Convert to bar pattern
  return values.map(v => CODE128_PATTERNS[v]).join('');
}

// Generate SVG barcode
function generateBarcodeSvg(text: string, width: number = 200, height: number = 60): string {
  const pattern = generateCode128Pattern(text);
  const barWidth = width / pattern.length;
  const barsHeight = height - 15; // Leave space for text
  
  let bars = '';
  let x = 0;
  
  for (const bit of pattern) {
    if (bit === '1') {
      bars += `<rect x="${x}" y="0" width="${barWidth}" height="${barsHeight}" fill="black"/>`;
    }
    x += barWidth;
  }
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  ${bars}
  <text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10">${text}</text>
</svg>`;
  
  return svg;
}

// Convert SVG to PNG using canvas-like approach (base64 SVG for Word)
function svgToBase64(svg: string): string {
  return btoa(svg);
}

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

// Create XML for logo image at top of document
const createLogoXml = (imageRelId: string): string => {
  // Size: approximately 60mm x 24mm = 2286000 x 914400 EMUs (1 mm = 38100 EMUs)
  const width = 2286000;
  const height = 914400;
  
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${width}" cy="${height}"/>
            <wp:docPr id="2" name="Logo"/>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="logo.png"/>
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

// Create XML for barcode image at bottom left of document (SVG version)
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
                    <pic:cNvPr id="0" name="barcode.svg"/>
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

const LOGO_URL = "https://qifcynwnxmtoxzpskmmt.supabase.co/storage/v1/object/public/templates/logo.png";

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

    // Fetch the logo
    console.log("Fetching logo from:", LOGO_URL);
    const logoResponse = await fetch(LOGO_URL);
    let logoBuffer: ArrayBuffer | null = null;
    if (logoResponse.ok) {
      logoBuffer = await logoResponse.arrayBuffer();
      console.log("Logo fetched, size:", logoBuffer.byteLength);
    } else {
      console.log("Warning: Could not fetch logo:", logoResponse.status);
    }

    // Load the DOCX as a zip
    const zip = await JSZip.loadAsync(templateBuffer);
    
    // Get the document.xml content
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      throw new Error("Could not read document.xml from template");
    }
    
    console.log("Original document length:", documentXml.length);

    let modifiedXml = documentXml;
    let imageIdCounter = 10; // Start from a high number to avoid conflicts
    
    // Update [Content_Types].xml to include image types
    let contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
    if (contentTypesXml) {
      if (!contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="png" ContentType="image/png"/></Types>'
        );
      }
      if (!contentTypesXml.includes('Extension="svg"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="svg" ContentType="image/svg+xml"/></Types>'
        );
      }
      if (!contentTypesXml.includes('Extension="jpeg"') && !contentTypesXml.includes('Extension="jpg"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>'
        );
      }
      zip.file("[Content_Types].xml", contentTypesXml);
    }

    // Get or create relationships file
    let relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
    if (!relsXml) {
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }

    // Add namespace declarations if missing
    if (!modifiedXml.includes('xmlns:wp=')) {
      modifiedXml = modifiedXml.replace(
        '<w:document',
        '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
      );
    }

    // Build content to insert after <w:body>
    let insertContent = '';
    
    // Add logo if available
    if (logoBuffer) {
      const logoId = `rIdLogo${imageIdCounter++}`;
      zip.file("word/media/logo.png", logoBuffer);
      
      const logoRel = `<Relationship Id="${logoId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>`;
      relsXml = relsXml.replace('</Relationships>', logoRel + '</Relationships>');
      
      insertContent += createLogoXml(logoId);
      console.log("Added logo to document body");
    }

    // Add phone numbers
    insertContent += createPhoneNumbersXml(israeliDisplay, localDisplay);

    // Insert content after <w:body> tag
    const bodyTagMatch = modifiedXml.match(/<w:body[^>]*>/);
    if (bodyTagMatch) {
      const bodyTagEnd = modifiedXml.indexOf(bodyTagMatch[0]) + bodyTagMatch[0].length;
      modifiedXml = 
        modifiedXml.slice(0, bodyTagEnd) + 
        insertContent + 
        modifiedXml.slice(bodyTagEnd);
      console.log("Inserted logo and phone numbers after <w:body> tag");
    } else {
      console.log("Warning: Could not find <w:body> tag");
    }

    // Handle barcode if provided
    if (barcode) {
      console.log("Generating barcode SVG for:", barcode);
      
      try {
        const barcodeSvg = generateBarcodeSvg(barcode, 200, 60);
        const barcodeId = `rIdBarcode${imageIdCounter++}`;
        
        // Save SVG as file
        zip.file("word/media/barcode.svg", barcodeSvg);
        
        // Add relationship
        const barcodeRel = `<Relationship Id="${barcodeId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/barcode.svg"/>`;
        relsXml = relsXml.replace('</Relationships>', barcodeRel + '</Relationships>');
        
        // Insert barcode XML before </w:body>
        const barcodeXml = createBarcodeXml(barcodeId);
        modifiedXml = modifiedXml.replace('</w:body>', barcodeXml + '</w:body>');
        console.log("Inserted barcode SVG before </w:body>");
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }

    // Update the relationships file
    zip.file("word/_rels/document.xml.rels", relsXml);

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

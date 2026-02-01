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

// Generate barcode as BMP image (simpler format that works everywhere)
function generateBarcodeBmp(text: string): Uint8Array {
  const pattern = generateCode128Pattern(text);
  const barWidth = 2; // pixels per bar
  const height = 50;
  const textHeight = 15;
  const totalHeight = height + textHeight;
  const width = pattern.length * barWidth + 20; // padding
  
  // BMP header (54 bytes for 24-bit BMP)
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows must be multiple of 4 bytes
  const imageSize = rowSize * totalHeight;
  const fileSize = 54 + imageSize;
  
  const bmp = new Uint8Array(fileSize);
  
  // BMP file header (14 bytes)
  bmp[0] = 0x42; bmp[1] = 0x4D; // 'BM'
  bmp[2] = fileSize & 0xFF;
  bmp[3] = (fileSize >> 8) & 0xFF;
  bmp[4] = (fileSize >> 16) & 0xFF;
  bmp[5] = (fileSize >> 24) & 0xFF;
  bmp[10] = 54; // pixel data offset
  
  // DIB header (40 bytes)
  bmp[14] = 40; // header size
  bmp[18] = width & 0xFF;
  bmp[19] = (width >> 8) & 0xFF;
  bmp[22] = totalHeight & 0xFF;
  bmp[23] = (totalHeight >> 8) & 0xFF;
  bmp[26] = 1; // color planes
  bmp[28] = 24; // bits per pixel
  
  // Pixel data (bottom-up)
  const padding = 10;
  for (let y = 0; y < totalHeight; y++) {
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + x * 3;
      
      // Default to white
      let isBlack = false;
      
      // Barcode area (from bottom, BMP is bottom-up, so y=0 is bottom)
      if (y >= textHeight && y < totalHeight) {
        const barcodeX = x - padding;
        if (barcodeX >= 0) {
          const patternIndex = Math.floor(barcodeX / barWidth);
          if (patternIndex < pattern.length) {
            isBlack = pattern[patternIndex] === '1';
          }
        }
      }
      
      // Set pixel color (BGR format)
      if (isBlack) {
        bmp[pixelOffset] = 0;     // B
        bmp[pixelOffset + 1] = 0; // G
        bmp[pixelOffset + 2] = 0; // R
      } else {
        bmp[pixelOffset] = 255;     // B
        bmp[pixelOffset + 1] = 255; // G
        bmp[pixelOffset + 2] = 255; // R
      }
    }
  }
  
  return bmp;
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
// Original logo dimensions from image: approximately 540x142 pixels (ratio ~3.8:1)
const createLogoXml = (imageRelId: string): string => {
  // Size: approximately 50mm x 13mm to match original aspect ratio
  // 1 mm = 38100 EMUs
  const width = 1905000;  // ~50mm
  const height = 495300;  // ~13mm (maintains 3.8:1 ratio)
  
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="120"/>
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

// Create XML for barcode image at bottom left of document
const createBarcodeXml = (imageRelId: string): string => {
  // Size: approximately 30mm x 10mm
  const width = 1143000;  // ~30mm
  const height = 381000;  // ~10mm
  
  return `
    <w:p>
      <w:pPr>
        <w:jc w:val="left"/>
        <w:spacing w:before="240" w:after="0"/>
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
                    <pic:cNvPr id="0" name="barcode.bmp"/>
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
      if (!contentTypesXml.includes('Extension="bmp"')) {
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          '<Default Extension="bmp" ContentType="image/bmp"/></Types>'
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
      console.log("Generating barcode BMP for:", barcode);
      
      try {
        const barcodeBmp = generateBarcodeBmp(barcode);
        const barcodeId = `rIdBarcode${imageIdCounter++}`;
        
        // Save BMP as file
        zip.file("word/media/barcode.bmp", barcodeBmp);
        console.log("Barcode BMP size:", barcodeBmp.length);
        
        // Add relationship
        const barcodeRel = `<Relationship Id="${barcodeId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/barcode.bmp"/>`;
        relsXml = relsXml.replace('</Relationships>', barcodeRel + '</Relationships>');
        
        // Insert barcode XML before </w:body>
        const barcodeXml = createBarcodeXml(barcodeId);
        modifiedXml = modifiedXml.replace('</w:body>', barcodeXml + '</w:body>');
        console.log("Inserted barcode BMP before </w:body>");
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }

    // Update the relationships file
    zip.file("word/_rels/document.xml.rels", relsXml);

    console.log("Modified document length:", modifiedXml.length);

    // Update the document.xml in the zip
    zip.file("word/document.xml", modifiedXml);

    // Generate the output docx as arraybuffer
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

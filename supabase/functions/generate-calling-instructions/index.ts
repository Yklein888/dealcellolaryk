import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";

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

// Code128 bar patterns
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
  
  return values.map(v => CODE128_PATTERNS[v]).join('');
}

// Generate barcode as PNG image
function generateBarcodePng(text: string): Uint8Array {
  const pattern = generateCode128Pattern(text);
  const barWidth = 2;
  const height = 60;
  const padding = 10;
  const width = pattern.length * barWidth + padding * 2;

  // Create raw pixel data (RGBA)
  const pixels = new Uint8Array(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Check if in barcode area
      const barcodeX = x - padding;
      let isBlack = false;
      
      if (barcodeX >= 0 && barcodeX < pattern.length * barWidth) {
        const patternIndex = Math.floor(barcodeX / barWidth);
        isBlack = pattern[patternIndex] === '1';
      }
      
      // Set RGBA values
      const color = isBlack ? 0 : 255;
      pixels[idx] = color;     // R
      pixels[idx + 1] = color; // G
      pixels[idx + 2] = color; // B
      pixels[idx + 3] = 255;   // A (fully opaque)
    }
  }

  // Create PNG manually
  return createPng(width, height, pixels);
}

// CRC32 table for PNG
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ 0xFFFFFFFF;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

function createPng(width: number, height: number, pixels: Uint8Array): Uint8Array {
  // Create raw image data with filter bytes
  const rowSize = width * 4 + 1; // +1 for filter byte
  const rawData = new Uint8Array(height * rowSize);
  
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // No filter
    for (let x = 0; x < width * 4; x++) {
      rawData[y * rowSize + 1 + x] = pixels[y * width * 4 + x];
    }
  }

  // Compress using deflate (simple uncompressed blocks)
  const compressedData = deflateUncompressed(rawData);

  // Build PNG chunks
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = new Uint8Array(13);
  ihdrData[0] = (width >> 24) & 0xFF;
  ihdrData[1] = (width >> 16) & 0xFF;
  ihdrData[2] = (width >> 8) & 0xFF;
  ihdrData[3] = width & 0xFF;
  ihdrData[4] = (height >> 24) & 0xFF;
  ihdrData[5] = (height >> 16) & 0xFF;
  ihdrData[6] = (height >> 8) & 0xFF;
  ihdrData[7] = height & 0xFF;
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', new Uint8Array(0));

  // Combine all
  const png = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdrChunk, offset); offset += ihdrChunk.length;
  png.set(idatChunk, offset); offset += idatChunk.length;
  png.set(iendChunk, offset);

  return png;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const length = data.length;
  const chunk = new Uint8Array(12 + length);
  
  // Length (4 bytes)
  chunk[0] = (length >> 24) & 0xFF;
  chunk[1] = (length >> 16) & 0xFF;
  chunk[2] = (length >> 8) & 0xFF;
  chunk[3] = length & 0xFF;
  
  // Type (4 bytes)
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }
  
  // Data
  chunk.set(data, 8);
  
  // CRC (4 bytes) - calculated over type + data
  const crcData = new Uint8Array(4 + length);
  for (let i = 0; i < 4; i++) {
    crcData[i] = type.charCodeAt(i);
  }
  crcData.set(data, 4);
  const crc = crc32(crcData);
  chunk[8 + length] = (crc >> 24) & 0xFF;
  chunk[9 + length] = (crc >> 16) & 0xFF;
  chunk[10 + length] = (crc >> 8) & 0xFF;
  chunk[11 + length] = crc & 0xFF;
  
  return chunk;
}

function deflateUncompressed(data: Uint8Array): Uint8Array {
  // Simple deflate with uncompressed blocks
  const blockSize = 65535;
  const numBlocks = Math.ceil(data.length / blockSize);
  const output = new Uint8Array(2 + data.length + numBlocks * 5 + 4); // zlib header + blocks + adler32
  
  let offset = 0;
  
  // Zlib header
  output[offset++] = 0x78; // CMF
  output[offset++] = 0x01; // FLG
  
  // Data blocks
  for (let i = 0; i < data.length; i += blockSize) {
    const remaining = data.length - i;
    const len = Math.min(blockSize, remaining);
    const isLast = (i + len) >= data.length;
    
    output[offset++] = isLast ? 0x01 : 0x00; // BFINAL + BTYPE
    output[offset++] = len & 0xFF;
    output[offset++] = (len >> 8) & 0xFF;
    output[offset++] = (~len) & 0xFF;
    output[offset++] = ((~len) >> 8) & 0xFF;
    
    output.set(data.slice(i, i + len), offset);
    offset += len;
  }
  
  // Adler32 checksum
  const adler = adler32(data);
  output[offset++] = (adler >> 24) & 0xFF;
  output[offset++] = (adler >> 16) & 0xFF;
  output[offset++] = (adler >> 8) & 0xFF;
  output[offset++] = adler & 0xFF;
  
  return output.slice(0, offset);
}

// Format phone number from scientific notation to string
const formatPhoneNumber = (num: string | undefined): string => {
  if (!num) return '';
  
  if (num.includes('E') || num.includes('e')) {
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) {
      return parsed.toFixed(0);
    }
  }
  
  return num.replace(/[-\s]/g, '');
};

// Format Israeli number with dashes
const formatIsraeliDisplay = (num: string): string => {
  const digits = num.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 11) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 9) {
    return `0${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return num;
};

// Format international number (UK/Europe)
const formatInternationalDisplay = (num: string): string => {
  const digits = num.replace(/\D/g, '');
  
  if (digits.startsWith('44')) {
    return `44-${digits.slice(2)}`;
  }
  if (digits.length >= 10) {
    return `44-${digits}`;
  }
  return num;
};

// Format American number (+1-XXX-XXX-XXXX)
const formatAmericanDisplay = (num: string): string => {
  const digits = num.replace(/\D/g, '');
  
  // Remove leading 1 if present
  const cleanDigits = digits.startsWith('1') ? digits.slice(1) : digits;
  
  if (cleanDigits.length === 10) {
    return `+1-${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
  } else if (cleanDigits.length >= 10) {
    return `+1-${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
  }
  return num;
};

// Draw text with Right-to-Left support (reverse string for Hebrew)
function drawRtlText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number
) {
  // For mixed text (Hebrew + numbers), we need to handle RTL properly
  // Split into Hebrew and non-Hebrew parts
  const parts: { text: string; isHebrew: boolean }[] = [];
  let currentPart = '';
  let isCurrentHebrew = false;
  
  for (const char of text) {
    const isHebrew = /[\u0590-\u05FF]/.test(char);
    if (currentPart === '') {
      isCurrentHebrew = isHebrew;
      currentPart = char;
    } else if (isHebrew === isCurrentHebrew) {
      currentPart += char;
    } else {
      parts.push({ text: currentPart, isHebrew: isCurrentHebrew });
      currentPart = char;
      isCurrentHebrew = isHebrew;
    }
  }
  if (currentPart) {
    parts.push({ text: currentPart, isHebrew: isCurrentHebrew });
  }
  
  // Reverse the order for RTL
  parts.reverse();
  
  // Draw each part
  let currentX = x;
  for (const part of parts) {
    const textToDraw = part.isHebrew ? part.text.split('').reverse().join('') : part.text;
    const width = font.widthOfTextAtSize(textToDraw, size);
    
    page.drawText(textToDraw, {
      x: currentX,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    
    currentX += width;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { israeliNumber, localNumber, barcode, isAmericanSim } = await req.json();
    
    const formattedIsraeli = formatPhoneNumber(israeliNumber);
    const formattedLocal = formatPhoneNumber(localNumber);
    
    const israeliDisplay = formattedIsraeli ? formatIsraeliDisplay(formattedIsraeli) : '---';
    // For American SIM, format as US number (+1-XXX-XXX-XXXX)
    const localDisplay = formattedLocal 
      ? (isAmericanSim ? formatAmericanDisplay(formattedLocal) : formatInternationalDisplay(formattedLocal)) 
      : '---';

    console.log("Input Israeli:", israeliNumber, "-> Formatted:", israeliDisplay);
    console.log("Input Local:", localNumber, "-> Formatted:", localDisplay);
    console.log("Barcode:", barcode);
    console.log("Is American SIM:", isAmericanSim);

    // Fetch PDF template from Storage (use different template for American SIM if available)
    const templateName = isAmericanSim 
      ? 'calling-instructions-template-american.pdf' 
      : 'calling-instructions-template.pdf';
    const templateUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/templates/${templateName}`;
    console.log("Fetching PDF template from:", templateUrl);
    
    // Try to fetch the template, fallback to European template if American not found
    let templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok && isAmericanSim) {
      console.log("American template not found, falling back to European template");
      const fallbackUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/templates/calling-instructions-template.pdf`;
      templateResponse = await fetch(fallbackUrl);
    }
    
    if (!templateResponse.ok) {
      throw new Error(`Template fetch failed: ${templateResponse.status} ${templateResponse.statusText}`);
    }
    
    const templateBytes = await templateResponse.arrayBuffer();
    console.log("Template fetched, size:", templateBytes.byteLength);

    // Load the PDF - the original document remains UNCHANGED
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];
    
    // Get page dimensions
    const { width: pageWidth, height: pageHeight } = page.getSize();
    console.log("Page dimensions:", pageWidth, "x", pageHeight);

    // Embed standard font (Helvetica for numbers, since Hebrew won't display correctly with standard fonts)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // === ADD OVERLAY: Phone numbers at top ===
    // Position: Right side (RTL document), below the header
    // Numbers only - Hebrew labels are already in the template
    const fontSize = 14;
    const rightMargin = pageWidth - 50; // 50pt from right edge
    const topY = pageHeight - 120; // Position for Israeli number

    // Draw Israeli number (right-aligned)
    const israeliWidth = boldFont.widthOfTextAtSize(israeliDisplay, fontSize);
    page.drawText(israeliDisplay, {
      x: rightMargin - israeliWidth,
      y: topY,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Draw Local number (below Israeli)
    const localWidth = boldFont.widthOfTextAtSize(localDisplay, fontSize);
    page.drawText(localDisplay, {
      x: rightMargin - localWidth,
      y: topY - 25,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // === ADD OVERLAY: Barcode at bottom center ===
    if (barcode) {
      console.log("Generating barcode PNG for:", barcode);
      
      try {
        const barcodePng = generateBarcodePng(barcode);
        console.log("Barcode PNG size:", barcodePng.length);
        
        const barcodeImage = await pdfDoc.embedPng(barcodePng);
        
        // Barcode dimensions: ~60mm x 20mm = ~170pt x 57pt
        const barcodeWidth = 170;
        const barcodeHeight = 57;
        const barcodeX = (pageWidth - barcodeWidth) / 2; // Center horizontally
        const barcodeY = 40; // 40pt from bottom
        
        page.drawImage(barcodeImage, {
          x: barcodeX,
          y: barcodeY,
          width: barcodeWidth,
          height: barcodeHeight,
        });
        
        // Draw barcode text below the barcode
        const barcodeTextWidth = font.widthOfTextAtSize(barcode, 10);
        page.drawText(barcode, {
          x: (pageWidth - barcodeTextWidth) / 2,
          y: barcodeY - 15,
          size: 10,
          font,
          color: rgb(0, 0, 0),
        });
        
        console.log("Barcode added at:", barcodeX, barcodeY);
      } catch (error) {
        console.error('Error adding barcode:', error);
      }
    }

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    console.log("Generated PDF size:", pdfBytes.length);

    // Return the PDF (convert Uint8Array to ArrayBuffer for Response)
    return new Response(pdfBytes.buffer as ArrayBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="calling-instructions-${formattedIsraeli || 'sim'}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("Error generating PDF:", error);
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

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const config = {
  maxDuration: 60,
};

const formatPhoneNumber = (num) => {
  if (!num) return '';
  if (num.includes('E') || num.includes('e')) {
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) {
      return parsed.toFixed(0);
    }
  }
  return num.replace(/[-\s]/g, '');
};

const formatIsraeliDisplay = (num) => {
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

const formatInternationalDisplay = (num) => {
  const digits = num.replace(/\D/g, '');
  if (digits.startsWith('44')) {
    return `44-${digits.slice(2)}`;
  }
  if (digits.length >= 10) {
    return `44-${digits}`;
  }
  return num;
};

const formatAmericanDisplay = (num) => {
  const digits = num.replace(/\D/g, '');
  const cleanDigits = digits.startsWith('1') ? digits.slice(1) : digits;
  if (cleanDigits.length === 10) {
    return `+1-${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6)}`;
  } else if (cleanDigits.length >= 10) {
    return `+1-${cleanDigits.slice(0, 3)}-${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
  }
  return num;
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).send('ok');
  }

  try {
    const { israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate, simNumber } = req.body;

    const formattedIsraeli = formatPhoneNumber(israeliNumber);
    const formattedLocal = formatPhoneNumber(localNumber);

    const israeliDisplay = formattedIsraeli ? formatIsraeliDisplay(formattedIsraeli) : '---';
    const localDisplay = formattedLocal
      ? (isAmericanSim ? formatAmericanDisplay(formattedLocal) : formatInternationalDisplay(formattedLocal))
      : '---';

    console.log('Input Israeli:', israeliNumber, '-> Formatted:', israeliDisplay);
    console.log('Input Local:', localNumber, '-> Formatted:', localDisplay);

    const supabaseUrl = process.env.MAIN_SUPABASE_URL;
    if (!supabaseUrl) {
      return res.status(500).json({ error: 'Supabase URL not configured' });
    }

    // Fetch PDF template from public storage
    const templateName = isAmericanSim
      ? 'calling-instructions-template-american.pdf'
      : 'calling-instructions-template.pdf';
    const templateUrl = `${supabaseUrl}/storage/v1/object/public/templates/${templateName}`;

    console.log('Fetching PDF template from:', templateUrl);

    let templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok && isAmericanSim) {
      console.log('American template not found, falling back to European');
      const fallbackUrl = `${supabaseUrl}/storage/v1/object/public/templates/calling-instructions-template.pdf`;
      templateResponse = await fetch(fallbackUrl);
    }

    if (!templateResponse.ok) {
      return res.status(500).json({ error: `Template fetch failed: ${templateResponse.status}` });
    }

    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const page = pages[0];

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const leftMargin = 40;

    if (isAmericanSim) {
      const titleFontSize = 18;
      const infoFontSize = 14;
      const labelFontSize = 11;
      let currentY = pageHeight - 50;

      if (packageName) {
        page.drawText(packageName, {
          x: leftMargin,
          y: currentY,
          size: titleFontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        currentY -= 28;
      }

      if (expiryDate) {
        const expiryLabel = 'Expiry: ';
        page.drawText(expiryLabel, {
          x: leftMargin,
          y: currentY,
          size: labelFontSize,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(expiryDate, {
          x: leftMargin + font.widthOfTextAtSize(expiryLabel, labelFontSize) + 4,
          y: currentY,
          size: infoFontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        currentY -= 24;
      }

      const israeliLabel = 'Israeli: ';
      page.drawText(israeliLabel, {
        x: leftMargin,
        y: currentY,
        size: labelFontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(israeliDisplay, {
        x: leftMargin + font.widthOfTextAtSize(israeliLabel, labelFontSize) + 4,
        y: currentY,
        size: infoFontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      currentY -= 24;

      const localLabel = 'US Number: ';
      page.drawText(localLabel, {
        x: leftMargin,
        y: currentY,
        size: labelFontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(localDisplay, {
        x: leftMargin + font.widthOfTextAtSize(localLabel, labelFontSize) + 4,
        y: currentY,
        size: infoFontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
    } else {
      const fontSize = 14;
      const labelFontSize = 10;
      const topY = pageHeight - 60;

      const israeliLabel = ': Israeli Number';
      page.drawText(israeliLabel, {
        x: leftMargin,
        y: topY,
        size: labelFontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(israeliDisplay, {
        x: leftMargin + font.widthOfTextAtSize(israeliLabel, labelFontSize) + 8,
        y: topY,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      const localLabel = ': Local Number';
      page.drawText(localLabel, {
        x: leftMargin,
        y: topY - 22,
        size: labelFontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      page.drawText(localDisplay, {
        x: leftMargin + font.widthOfTextAtSize(localLabel, labelFontSize) + 8,
        y: topY - 22,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="calling-instructions-${formattedIsraeli || 'sim'}.pdf"`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: error.message });
  }
}

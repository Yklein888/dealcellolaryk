import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, convertInchesToTwip, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';

// Convert scientific notation (e.g., 9.72E+11) to regular number string
const formatPhoneNumber = (num: string | undefined): string => {
  if (!num) return '';
  
  // Check if it's in scientific notation
  if (num.includes('E') || num.includes('e')) {
    const parsed = parseFloat(num);
    if (!isNaN(parsed)) {
      return parsed.toFixed(0);
    }
  }
  
  return num;
};

// Format phone number with dashes for display (Israeli format: 0722-587-081)
const formatIsraeliDisplay = (num: string): string => {
  if (num.length === 10) {
    return `${num.slice(0, 4)}-${num.slice(4, 7)}-${num.slice(7)}`;
  }
  return num;
};

// Format international number with country code (UK format: 44-7429629581)
const formatInternationalDisplay = (num: string): string => {
  // If starts with country code like 44, format as 44-rest
  if (num.startsWith('44') && num.length > 10) {
    return `44-${num.slice(2)}`;
  }
  return num;
};

export const generateCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);
  const formattedLocal = formatPhoneNumber(localNumber);

  const israeliDisplay = formattedIsraeli ? formatIsraeliDisplay(formattedIsraeli) : '---';
  const localDisplay = formattedLocal ? formatInternationalDisplay(formattedLocal) : '---';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children: [
          // Israeli Number - Top Left (RTL so appears on right)
          new Paragraph({
            children: [
              new TextRun({
                text: `מספר ישראלי: ${israeliDisplay}`,
                bold: true,
                size: 28,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),

          // Local Number
          new Paragraph({
            children: [
              new TextRun({
                text: `מספר מקומי: ${localDisplay}`,
                bold: true,
                size: 28,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 600 },
          }),

          // Customer Service Header
          new Paragraph({
            children: [
              new TextRun({
                text: 'מוקד שירות לקוחות:',
                bold: true,
                size: 36,
                font: 'Arial',
                color: 'FF6600',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // Israeli Service Number
          new Paragraph({
            children: [
              new TextRun({
                text: '0722-163-444',
                bold: true,
                size: 32,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),

          // International Service Number
          new Paragraph({
            children: [
              new TextRun({
                text: '44-203-129-090200',
                bold: true,
                size: 32,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),

          // Service Languages
          new Paragraph({
            children: [
              new TextRun({
                text: '(שפת השירות: עברית | אנגלית | אידיש)',
                size: 24,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // Good Flight Wish
          new Paragraph({
            children: [
              new TextRun({
                text: 'טיסה נעימה ובטוחה!',
                bold: true,
                size: 28,
                font: 'Arial',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),

          // Company Name
          new Paragraph({
            children: [
              new TextRun({
                text: 'דיל סלולר',
                bold: true,
                size: 36,
                font: 'Arial',
                color: 'FF6600',
              }),
            ],
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `הוראות-חיוג-${formattedIsraeli || 'sim'}.docx`);
};

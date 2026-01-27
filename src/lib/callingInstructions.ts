import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
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

export const generateCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);
  const formattedLocal = formatPhoneNumber(localNumber);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'הוראות חיוג מחו"ל לישראל',
                bold: true,
                size: 48, // 24pt
                font: 'David',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            heading: HeadingLevel.HEADING_1,
          }),

          // Separator line
          new Paragraph({
            border: {
              bottom: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { after: 400 },
          }),

          // Phone numbers section
          new Paragraph({
            children: [
              new TextRun({
                text: 'מספר ישראלי: ',
                bold: true,
                size: 32, // 16pt
                font: 'David',
              }),
              new TextRun({
                text: formattedIsraeli || '---',
                size: 32,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'מספר מקומי: ',
                bold: true,
                size: 32,
                font: 'David',
              }),
              new TextRun({
                text: formattedLocal || '---',
                size: 32,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
          }),

          // Instructions header
          new Paragraph({
            children: [
              new TextRun({
                text: 'הוראות חיוג:',
                bold: true,
                size: 28,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
          }),

          // Instructions
          new Paragraph({
            children: [
              new TextRun({
                text: '1. חייגו את המספר הישראלי כפי שמופיע למעלה',
                size: 24,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: '2. המתינו לצליל חיוג',
                size: 24,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: '3. הקישו את מספר הטלפון בישראל אליו תרצו להתקשר',
                size: 24,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: '4. לחצו על # לסיום',
                size: 24,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 300 },
          }),

          // Note
          new Paragraph({
            children: [
              new TextRun({
                text: 'שימו לב: ',
                bold: true,
                size: 22,
                font: 'David',
                italics: true,
              }),
              new TextRun({
                text: 'יש להקיש את מספר הטלפון עם קידומת 0 (לדוגמה: 050-1234567)',
                size: 22,
                font: 'David',
                italics: true,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400 },
          }),

          // Footer separator
          new Paragraph({
            border: {
              bottom: {
                color: '000000',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { after: 200 },
          }),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: 'נסיעה טובה!',
                bold: true,
                size: 28,
                font: 'David',
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `הוראות-חיוג-${formattedIsraeli || 'sim'}.docx`);
};

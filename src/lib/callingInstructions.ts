import { saveAs } from 'file-saver';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

// Fetch DOCX blob from the backend (internal function)
const fetchCallingInstructionsDocx = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string
): Promise<Blob> => {
  const templateUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/templates/calling-instructions-template.docx`;

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-calling-instructions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        israeliNumber,
        localNumber,
        templateUrl,
        barcode,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return await response.blob();
};

// Print calling instructions directly without downloading
export const printCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);

  try {
    // 1. Fetch DOCX from backend
    const docxBlob = await fetchCallingInstructionsDocx(israeliNumber, localNumber, barcode);

    // 2. Create hidden containers for docx-preview
    const bodyContainer = document.createElement('div');
    const styleContainer = document.createElement('style');
    
    bodyContainer.style.position = 'absolute';
    bodyContainer.style.left = '-9999px';
    bodyContainer.style.top = '0';
    bodyContainer.style.width = '210mm'; // A4 width
    bodyContainer.style.backgroundColor = '#ffffff';
    bodyContainer.style.direction = 'rtl';
    
    document.body.appendChild(bodyContainer);
    document.head.appendChild(styleContainer);

    // 3. Render DOCX to HTML
    await renderAsync(docxBlob, bodyContainer, styleContainer, {
      className: 'docx-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: false,
      trimXmlDeclaration: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    });

    // Wait for images/fonts to load
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Find pages or use container
    const pages = bodyContainer.querySelectorAll('.docx-wrapper section');
    const elementsToCapture = pages.length > 0 ? Array.from(pages) : [bodyContainer];

    // 5. Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;

    for (let i = 0; i < elementsToCapture.length; i++) {
      const element = elementsToCapture[i] as HTMLElement;
      
      // Capture as canvas with high quality
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
      });

      // Calculate dimensions to fit A4
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }

      // Add image to PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
    }

    // 6. Create PDF blob and URL
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // 7. Create hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    
    document.body.appendChild(iframe);
    iframe.src = pdfUrl;

    // 8. Trigger print when loaded
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          // Fallback: open in new tab if print fails
          window.open(pdfUrl, '_blank');
        }
      }, 300);
    };

    // 9. Cleanup after print dialog closes (approximately)
    setTimeout(() => {
      document.body.removeChild(iframe);
      document.body.removeChild(bodyContainer);
      document.head.removeChild(styleContainer);
      URL.revokeObjectURL(pdfUrl);
    }, 5000);

  } catch (error) {
    console.error('Error printing calling instructions:', error);
    throw error;
  }
};

// Download calling instructions as DOCX (fallback/backup)
export const downloadCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);

  try {
    const docxBlob = await fetchCallingInstructionsDocx(israeliNumber, localNumber, barcode);
    saveAs(docxBlob, `הוראות-חיוג-${formattedIsraeli || 'sim'}.docx`);
  } catch (error) {
    console.error('Error downloading calling instructions:', error);
    throw error;
  }
};

// Legacy function - now calls print instead of download
export const generateCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string
): Promise<void> => {
  // For backwards compatibility, this now prints instead of downloading
  return printCallingInstructions(israeliNumber, localNumber, barcode);
};

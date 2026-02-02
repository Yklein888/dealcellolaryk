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

// Fetch PDF from the backend Edge Function
const fetchCallingInstructionsPdf = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string,
  isAmericanSim?: boolean,
  packageName?: string,
  expiryDate?: string
): Promise<Blob> => {
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
        barcode,
        isAmericanSim,
        packageName,
        expiryDate,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return await response.blob();
};

// Print calling instructions directly (PDF received from server)
export const printCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string,
  isAmericanSim?: boolean,
  packageName?: string,
  expiryDate?: string
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);

  try {
    // 1. Fetch PDF from backend (already has overlay with numbers and barcode)
    const pdfBlob = await fetchCallingInstructionsPdf(israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate);
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // 2. Create hidden iframe for printing
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

    // 3. Trigger print when PDF is loaded
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          // Fallback: open PDF in new tab if print fails
          window.open(pdfUrl, '_blank');
        }
      }, 300);
    };

    // 4. Cleanup after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(pdfUrl);
    }, 10000);

  } catch (error) {
    console.error('Error printing calling instructions:', error);
    throw error;
  }
};

// Download calling instructions as PDF
export const downloadCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string,
  isAmericanSim?: boolean,
  packageName?: string,
  expiryDate?: string
): Promise<void> => {
  const formattedIsraeli = formatPhoneNumber(israeliNumber);

  try {
    const pdfBlob = await fetchCallingInstructionsPdf(israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate);
    const simType = isAmericanSim ? 'אמריקאי' : 'אירופאי';
    saveAs(pdfBlob, `הוראות-חיוג-${simType}-${formattedIsraeli || 'sim'}.pdf`);
  } catch (error) {
    console.error('Error downloading calling instructions:', error);
    throw error;
  }
};

// Legacy function - now calls print
export const generateCallingInstructions = async (
  israeliNumber: string | undefined,
  localNumber: string | undefined,
  barcode?: string,
  isAmericanSim?: boolean,
  packageName?: string,
  expiryDate?: string
): Promise<void> => {
  return printCallingInstructions(israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate);
};

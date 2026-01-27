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

  try {
    // Get the template URL - it's in the public folder
    const templateUrl = `${window.location.origin}/templates/calling-instructions-template.docx`;

    // Call the edge function to generate the document
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
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // Get the blob and save it
    const blob = await response.blob();
    saveAs(blob, `הוראות-חיוג-${formattedIsraeli || 'sim'}.docx`);
  } catch (error) {
    console.error('Error generating calling instructions:', error);
    throw error;
  }
};

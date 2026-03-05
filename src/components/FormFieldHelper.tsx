import { memo } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldHelperProps {
  label: string;
  hint?: string;
  error?: string;
  success?: string;
  required?: boolean;
  className?: string;
}

/**
 * Form field label with hint, error, and success messages
 */
export const FormFieldHelper = memo(function FormFieldHelper({
  label,
  hint,
  error,
  success,
  required,
  className,
}: FormFieldHelperProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      </div>

      {hint && !error && !success && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{hint}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 text-xs text-success">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}
    </div>
  );
});

FormFieldHelper.displayName = 'FormFieldHelper';

/**
 * Common field validation hints
 */
export const FIELD_HINTS = {
  phone: 'הזן מספר טלפון בתבנית: 050-1234567',
  email: 'הזן כתובת דוא״ל חוקית',
  currency: 'הזן סכום במטבע המבוקש',
  date: 'בחר תאריך מהלוח',
  name: 'הזן את השם המלא של האדם',
  address: 'הזן כתובת מלאה עם עיר ומיקוד',
};

/**
 * Common validation error messages
 */
export const VALIDATION_ERRORS = {
  required: 'שדה זה הוא חובה',
  email: 'כתובת דוא״ל לא חוקית',
  phone: 'מספר טלפון לא חוקי',
  minLength: (min: number) => `לפחות ${min} תווים`,
  maxLength: (max: number) => `לא יותר מ-${max} תווים`,
  number: 'יש להזין מספר',
  positive: 'יש להזין מספר חיובי',
  match: (field: string) => `לא תואם ל-${field}`,
};

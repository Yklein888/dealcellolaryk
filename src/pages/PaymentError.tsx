import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentError() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="p-6 rounded-full bg-destructive/20 mb-6">
        <XCircle className="h-16 w-16 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-3">התשלום נכשל</h1>
      <p className="text-muted-foreground mb-6">
        אירעה שגיאה בעיבוד התשלום. אנא נסה שוב או פנה לתמיכה.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate('/rentals')}>
          חזור להשכרות
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)}>
          נסה שוב
        </Button>
      </div>
    </div>
  );
}

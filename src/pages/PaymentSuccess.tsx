import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect after 5 seconds
    const timer = setTimeout(() => {
      navigate('/rentals');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="p-6 rounded-full bg-success/20 mb-6">
        <CheckCircle className="h-16 w-16 text-success" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-3">התשלום בוצע בהצלחה!</h1>
      <p className="text-muted-foreground mb-6">
        תודה על התשלום. מועבר לדף ההשכרות בעוד מספר שניות...
      </p>
      <Button onClick={() => navigate('/rentals')}>
        חזור להשכרות
      </Button>
    </div>
  );
}

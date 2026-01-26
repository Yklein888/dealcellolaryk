import { Sparkles, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { Rental, Repair } from '@/types/rental';

interface WelcomeBannerProps {
  overdueRentals: Rental[];
  readyRepairs: Repair[];
}

export function WelcomeBanner({ overdueRentals, readyRepairs }: WelcomeBannerProps) {
  const hasUrgent = overdueRentals.length > 0;
  const hasReady = readyRepairs.length > 0;

  return (
    <div className="mb-8 relative overflow-hidden animate-fade-in">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-accent/5 to-transparent rounded-3xl" />
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
      
      <div className="relative p-6 md:p-8 rounded-3xl glass border border-primary/20">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Icon */}
          <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-lg animate-float shrink-0">
            {hasUrgent ? (
              <AlertCircle className="h-8 w-8 md:h-10 md:w-10 text-white" />
            ) : hasReady ? (
              <Zap className="h-8 w-8 md:h-10 md:w-10 text-white" />
            ) : (
              <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-white" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              שלום! 👋
            </h2>
            <p className="text-base md:text-lg text-muted-foreground">
              {hasUrgent 
                ? `יש לך ${overdueRentals.length} השכרות באיחור שדורשות טיפול מיידי`
                : hasReady
                ? `${readyRepairs.length} תיקונים מוכנים ומחכים לאיסוף`
                : 'הכל תקין! אין פעולות דחופות כרגע'}
            </p>
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            hasUrgent 
              ? 'bg-destructive/10 text-destructive' 
              : hasReady 
              ? 'bg-warning/10 text-warning' 
              : 'bg-success/10 text-success'
          }`}>
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium text-sm">
              {hasUrgent ? 'דורש תשומת לב' : hasReady ? 'יש פעילות' : 'תקין'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

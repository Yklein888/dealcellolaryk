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
    <div className="mb-6 sm:mb-8 relative overflow-hidden animate-fade-in">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-accent/5 to-transparent rounded-2xl sm:rounded-3xl" />
      <div className="absolute -top-10 -left-10 w-32 sm:w-40 h-32 sm:h-40 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-32 sm:w-40 h-32 sm:h-40 bg-accent/20 rounded-full blur-3xl" />
      
      <div className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl glass border border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Icon */}
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-accent shadow-lg animate-float shrink-0">
            {hasUrgent ? (
              <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
            ) : hasReady ? (
              <Zap className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
            ) : (
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2">
              שלום! 👋
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
              {hasUrgent 
                ? `יש לך ${overdueRentals.length} השכרות באיחור שדורשות טיפול מיידי`
                : hasReady
                ? `${readyRepairs.length} תיקונים מוכנים ומחכים לאיסוף`
                : 'הכל תקין! אין פעולות דחופות כרגע'}
            </p>
          </div>

          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm self-start sm:self-center ${
            hasUrgent 
              ? 'bg-destructive/10 text-destructive' 
              : hasReady 
              ? 'bg-warning/10 text-warning' 
              : 'bg-success/10 text-success'
          }`}>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-medium">
              {hasUrgent ? 'דורש תשומת לב' : hasReady ? 'יש פעילות' : 'תקין'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

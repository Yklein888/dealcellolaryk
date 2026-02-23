import { memo } from 'react';
import { Sparkles } from 'lucide-react';

export const WelcomeBanner = memo(function WelcomeBanner() {
  return (
    <div className="mb-6 sm:mb-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-accent/5 to-transparent rounded-2xl sm:rounded-3xl" />
      <div className="absolute -top-10 -left-10 w-32 sm:w-40 h-32 sm:h-40 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-32 sm:w-40 h-32 sm:h-40 bg-accent/20 rounded-full blur-3xl" />

      <div className="relative rounded-2xl bg-gradient-to-bl from-primary/20 via-accent/10 to-background border border-primary/20 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary to-accent shadow-lg animate-float shrink-0">
            <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent font-extrabold">
              שלום! 👋
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
              ברוך הבא למערכת ניהול ההשכרות
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

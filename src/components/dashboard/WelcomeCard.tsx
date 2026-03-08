import { memo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, Sun, Moon, Sunset } from 'lucide-react';

interface WelcomeCardProps {
  overdueCount: number;
  readyRepairsCount: number;
  activeRentalsCount: number;
}

export const WelcomeCard = memo(function WelcomeCard({ 
  overdueCount, 
  readyRepairsCount, 
  activeRentalsCount 
}: WelcomeCardProps) {
  const { user } = useAuth();
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : hour < 21 ? 'ערב טוב' : 'לילה טוב';
  const GreetingIcon = hour < 12 ? Sun : hour < 17 ? Sun : hour < 21 ? Sunset : Moon;
  
  const userName = user?.email?.split('@')[0] || 'משתמש';
  
  // Build alerts list
  const alerts: string[] = [];
  if (overdueCount > 0) alerts.push(`${overdueCount} השכרות באיחור`);
  if (readyRepairsCount > 0) alerts.push(`${readyRepairsCount} תיקונים מוכנים לאיסוף`);
  
  return (
    <div className="relative overflow-hidden rounded-2xl mb-6 bg-gradient-to-l from-primary/20 via-accent/10 to-transparent border border-white/20 backdrop-blur-sm">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
      
      <div className="relative z-10 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <GreetingIcon className="h-5 w-5 text-warning" />
              <span className="text-sm text-muted-foreground">{greeting}</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">
              {userName}!
            </h2>
            <p className="text-muted-foreground text-sm">
              יש לך {activeRentalsCount} השכרות פעילות היום
            </p>
            
            {alerts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {alerts.map((alert, i) => (
                  <span 
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-warning/20 text-warning border border-warning/30"
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
                    </span>
                    {alert}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
});

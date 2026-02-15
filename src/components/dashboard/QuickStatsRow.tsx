import { memo, useMemo } from 'react';
import { 
  Calendar, 
  Activity,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { Rental, Repair } from '@/types/rental';
import { format, parseISO } from 'date-fns';

interface QuickStatsRowProps {
  rentals: Rental[];
  repairs: Repair[];
  readyRepairs: Repair[];
  isSupported: boolean;
  isSubscribed: boolean;
}

export const QuickStatsRow = memo(function QuickStatsRow({ 
  rentals, 
  repairs, 
  readyRepairs, 
  isSupported, 
  isSubscribed 
}: QuickStatsRowProps) {
  const todayReturns = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    return rentals.filter(r => r.status === 'active' && format(parseISO(r.endDate), 'yyyy-MM-dd') === todayStr).length;
  }, [rentals]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      <div className="p-4 rounded-2xl glass border border-success/20 flex items-center gap-4 card-glow">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-success/30 to-success/10 shadow-sm">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">תיקונים מוכנים</p>
          <p className="text-2xl font-bold text-success">{readyRepairs.length}</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl glass border border-accent/20 flex items-center gap-4 card-glow">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 shadow-sm">
          <Calendar className="h-6 w-6 text-accent" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">החזרות היום</p>
          <p className="text-2xl font-bold text-accent">{todayReturns}</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl glass border border-primary/20 flex items-center gap-4 card-glow">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/10 shadow-sm">
          <Activity className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">סה"כ השכרות</p>
          <p className="text-2xl font-bold text-primary">{rentals.length}</p>
        </div>
      </div>

      {isSupported && (
        <div className="p-4 rounded-2xl glass border border-primary/20 flex items-center gap-4 card-glow">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 shadow-sm">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">התראות פוש</p>
            <p className="text-base font-medium text-foreground">
              {isSubscribed ? 'מופעלות ✓' : 'לא מופעלות'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
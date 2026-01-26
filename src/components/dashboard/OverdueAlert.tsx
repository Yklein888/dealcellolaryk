import { AlertTriangle, Phone, Calendar } from 'lucide-react';
import { Rental } from '@/types/rental';
import { format, parseISO, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';

interface OverdueAlertProps {
  overdueRentals: Rental[];
}

export function OverdueAlert({ overdueRentals }: OverdueAlertProps) {
  if (overdueRentals.length === 0) return null;

  const today = new Date();

  return (
    <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '500ms' }}>
      <div className="stat-card border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/20 animate-pulse">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">השכרות באיחור</h2>
            <p className="text-sm text-muted-foreground">
              יש {overdueRentals.length} השכרות שעברו את תאריך ההחזרה
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {overdueRentals.map((rental, index) => {
            const daysOverdue = differenceInDays(today, parseISO(rental.endDate));
            return (
              <div 
                key={rental.id}
                className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-colors"
                style={{ animationDelay: `${550 + index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-foreground">{rental.customerName}</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-destructive/20 text-destructive">
                    {daysOverdue} ימים
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {rental.items.map(i => i.itemName).join(', ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

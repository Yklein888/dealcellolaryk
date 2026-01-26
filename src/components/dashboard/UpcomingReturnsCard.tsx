import { Calendar, ArrowLeft, Package2 } from 'lucide-react';
import { Rental } from '@/types/rental';
import { StatusBadge } from '@/components/StatusBadge';
import { format, parseISO, isBefore } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface UpcomingReturnsCardProps {
  upcomingReturns: Rental[];
}

export function UpcomingReturnsCard({ upcomingReturns }: UpcomingReturnsCardProps) {
  const today = new Date();

  return (
    <div className="stat-card animate-slide-up" style={{ animationDelay: '400ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          החזרות קרובות
        </h2>
        <Link 
          to="/rentals" 
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          הצג הכל
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
      
      {upcomingReturns.length === 0 ? (
        <div className="text-center py-8">
          <Package2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">אין החזרות קרובות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingReturns.slice(0, 5).map((rental, index) => {
            const isOverdue = isBefore(parseISO(rental.endDate), today);
            return (
              <div 
                key={rental.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.01]"
                style={{ animationDelay: `${450 + index * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-1 h-10 rounded-full ${isOverdue ? 'bg-destructive' : 'bg-primary'}`} />
                  <div>
                    <p className="font-medium text-foreground">{rental.customerName}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {rental.items.map(i => i.itemName).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium mb-1 ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                    {format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}
                  </p>
                  <StatusBadge 
                    status={isOverdue ? 'באיחור' : 'פעיל'} 
                    variant={isOverdue ? 'destructive' : 'info'} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

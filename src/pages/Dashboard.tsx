import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { 
  ShoppingCart, 
  Users, 
  Package, 
  AlertTriangle,
  Wrench,
  Clock,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { rentalStatusLabels, repairStatusLabels } from '@/types/rental';

export default function Dashboard() {
  const { stats, rentals, repairs, getUpcomingReturns } = useRental();
  const upcomingReturns = getUpcomingReturns();
  const today = new Date();

  const activeRentals = rentals.filter(r => r.status === 'active');
  const overdueRentals = activeRentals.filter(r => isBefore(parseISO(r.endDate), today));
  const pendingRepairs = repairs.filter(r => r.status !== 'collected');

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="דאשבורד" 
        description="סקירה כללית של המערכת"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="השכרות פעילות"
          value={stats.activeRentals}
          icon={ShoppingCart}
          variant="primary"
        />
        <StatCard
          title="לקוחות"
          value={stats.totalCustomers}
          icon={Users}
          variant="default"
        />
        <StatCard
          title="פריטים במלאי"
          value={stats.itemsInStock}
          icon={Package}
          variant="success"
        />
        <StatCard
          title="באיחור"
          value={stats.overdueReturns}
          icon={AlertTriangle}
          variant="destructive"
        />
        <StatCard
          title="תיקונים בתהליך"
          value={stats.repairsInProgress}
          icon={Wrench}
          variant="warning"
        />
        <StatCard
          title="החזרות קרובות"
          value={stats.upcomingReturns}
          icon={Clock}
          variant="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Returns */}
        <div className="stat-card">
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
            <p className="text-muted-foreground text-center py-8">אין החזרות קרובות</p>
          ) : (
            <div className="space-y-3">
              {upcomingReturns.slice(0, 5).map((rental) => {
                const isOverdue = isBefore(parseISO(rental.endDate), today);
                return (
                  <div 
                    key={rental.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{rental.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {rental.items.map(i => i.itemName).join(', ')}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
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

        {/* Recent Repairs */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5 text-warning" />
              תיקונים אחרונים
            </h2>
            <Link 
              to="/repairs" 
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              הצג הכל
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          
          {pendingRepairs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">אין תיקונים בתהליך</p>
          ) : (
            <div className="space-y-3">
              {pendingRepairs.slice(0, 5).map((repair) => (
                <div 
                  key={repair.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-foreground">{repair.customerName}</p>
                    <p className="text-sm text-muted-foreground">{repair.deviceType} - {repair.problemDescription}</p>
                  </div>
                  <StatusBadge 
                    status={repairStatusLabels[repair.status]} 
                    variant={
                      repair.status === 'ready' ? 'success' : 
                      repair.status === 'in_lab' ? 'warning' : 'default'
                    } 
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Rentals Alert */}
        {overdueRentals.length > 0 && (
          <div className="lg:col-span-2 stat-card border-destructive/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">השכרות באיחור</h2>
                <p className="text-sm text-muted-foreground">יש {overdueRentals.length} השכרות שעברו את תאריך ההחזרה</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {overdueRentals.map((rental) => (
                <div 
                  key={rental.id}
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <p className="font-medium text-foreground">{rental.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    תאריך החזרה: {format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

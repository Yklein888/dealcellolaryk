import { useState, useEffect } from 'react';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { GlobalSearch } from '@/components/GlobalSearch';
import { QuickActions } from '@/components/QuickActions';
import { PriceCalculator } from '@/components/PriceCalculator';
import { NotificationSettings } from '@/components/NotificationSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { 
  ShoppingCart, 
  Users, 
  Package, 
  AlertTriangle,
  Wrench,
  Clock,
  Calendar,
  ArrowLeft,
  Search,
  Plus,
  Calculator,
  Sparkles,
  TrendingUp,
  Activity,
  Bell,
} from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { repairStatusLabels } from '@/types/rental';

export default function Dashboard() {
  const { stats, rentals, repairs, getUpcomingReturns, loading } = useRental();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const { isSubscribed, notifyRentalDue, isSupported } = usePushNotifications();

  // Check for rentals due soon and send notifications
  useEffect(() => {
    if (!isSubscribed) return;

    const checkDueRentals = () => {
      const today = new Date();
      rentals
        .filter(r => r.status === 'active')
        .forEach(rental => {
          const endDate = parseISO(rental.endDate);
          const daysUntilDue = differenceInDays(endDate, today);
          
          // Notify if due today or tomorrow
          if (daysUntilDue <= 1 && daysUntilDue >= 0) {
            notifyRentalDue(rental.customerName, format(endDate, 'dd/MM/yyyy', { locale: he }));
          }
        });
    };

    // Check on mount and every hour
    checkDueRentals();
    const interval = setInterval(checkDueRentals, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSubscribed, rentals, notifyRentalDue]);

  const upcomingReturns = getUpcomingReturns();
  const today = new Date();

  const activeRentals = rentals.filter(r => r.status === 'active');
  const overdueRentals = activeRentals.filter(r => isBefore(parseISO(r.endDate), today));
  const pendingRepairs = repairs.filter(r => r.status !== 'collected');
  const readyRepairs = repairs.filter(r => r.status === 'ready');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto animate-pulse text-primary" />
          <p className="mt-4 text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="דאשבורד" 
        description="סקירה כללית של המערכת"
      >
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsSearchOpen(true)}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">חיפוש</span>
            <kbd className="hidden sm:inline px-2 py-0.5 text-xs rounded bg-muted">⌘K</kbd>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsCalculatorOpen(true)}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">מחשבון</span>
          </Button>
          <Button 
            variant="glow" 
            onClick={() => setIsQuickActionsOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">פעולה מהירה</span>
          </Button>
        </div>
      </PageHeader>

      {/* Welcome Banner */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-l from-primary/20 via-primary/10 to-transparent border border-primary/20">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">שלום! 👋</h2>
            <p className="text-muted-foreground">
              {overdueRentals.length > 0 
                ? `יש לך ${overdueRentals.length} השכרות באיחור שדורשות טיפול`
                : readyRepairs.length > 0
                ? `${readyRepairs.length} תיקונים מוכנים לאיסוף`
                : 'הכל תקין! אין פעולות דחופות'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid - Modern Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-gradient-to-l from-green-500/10 to-green-500/5 border border-green-500/20 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/20">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">תיקונים מוכנים</p>
            <p className="text-2xl font-bold text-green-600">{readyRepairs.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-l from-blue-500/10 to-blue-500/5 border border-blue-500/20 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">החזרות היום</p>
            <p className="text-2xl font-bold text-blue-600">
              {upcomingReturns.filter(r => 
                format(parseISO(r.endDate), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
              ).length}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-l from-purple-500/10 to-purple-500/5 border border-purple-500/20 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
            <Activity className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">סה"כ השכרות</p>
            <p className="text-2xl font-bold text-purple-600">{rentals.length}</p>
          </div>
        </div>

        {/* Notification Settings */}
        {isSupported && (
          <div className="p-4 rounded-xl bg-gradient-to-l from-primary/10 to-primary/5 border border-primary/20 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">התראות פוש</p>
              <p className="text-base font-medium text-foreground">
                {isSubscribed ? 'מופעלות ✓' : 'לא מופעלות'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Notification Settings Card */}
      <div className="mb-8">
        <NotificationSettings />
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
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                      {repair.repairNumber}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{repair.customerName}</p>
                      <p className="text-sm text-muted-foreground">{repair.deviceType}</p>
                    </div>
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

      {/* Modals */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <QuickActions isOpen={isQuickActionsOpen} onClose={() => setIsQuickActionsOpen(false)} />
      <PriceCalculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
    </div>
  );
}

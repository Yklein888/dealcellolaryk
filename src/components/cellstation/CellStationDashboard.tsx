import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Package,
  Smartphone,
  Zap,
  CloudDownload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeftRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRental } from '@/hooks/useRental';
import { useCellstationSync, SimCard } from '@/hooks/useCellstationSync';
import { ItemCategory } from '@/types/rental';
import { ActiveRentalsTab } from './ActiveRentalsTab';
import { AvailableSimsTab } from './AvailableSimsTab';
import { NeedsReplacementTab } from './NeedsReplacementTab';
import { ExpiredSimsTab } from './ExpiredSimsTab';
import { ActivationTab } from './ActivationTab';
import { AllSimsTab } from './AllSimsTab';

// ============================================
// Cell Station Dashboard v6.0
// New categorized structure with mandatory customer selection
// ============================================

const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzKhHEQeldMrsNjL8RZMigkPvIKJDRSWD0WoDYpyGPAmGxBYFxDi_9EiUldFjnZ6TIE/exec';

// === Types ===
interface CellStationRental {
  rental_id: string;
  id: string;
  sim: string;
  local_number: string;
  israel_number: string;
  plan: string;
  start_date: string;
  end_date: string;
  days: string;
  customer_name: string;
  customer_phone: string;
  status: string;
}

interface Stats {
  available: number;
  rented: number;
  overdue: number;
  expired: number;
  needsReplacement: number;
  total: number;
}

// === Stat Card Component ===
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'default',
  highlight = false,
  onClick,
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'destructive' | 'primary';
  highlight?: boolean;
  onClick?: () => void;
}) {
  const variantStyles = {
    default: 'border-border/50',
    warning: 'border-warning/50 bg-warning/5',
    success: 'border-success/50 bg-success/5',
    destructive: 'border-destructive/50 bg-destructive/5',
    primary: 'border-primary/50 bg-primary/5',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-warning',
    success: 'text-success',
    destructive: 'text-destructive',
    primary: 'text-primary',
  };

  return (
    <Card 
      className={cn(
        'glass-card transition-all duration-200 cursor-pointer hover:shadow-lg',
        variantStyles[variant],
        highlight && 'ring-2 ring-warning shadow-lg shadow-warning/20'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 text-center">
        <Icon className={cn('h-6 w-6 mx-auto mb-2', iconStyles[variant])} />
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}

// Format phone number - add leading 0 if missing
const formatPhone = (phone: string | number | null | undefined): string => {
  if (phone === null || phone === undefined || phone === '') return '';
  const str = String(phone);
  const cleaned = str.replace(/\D/g, '');
  if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned.startsWith('0') ? cleaned : '0' + cleaned;
};

// Format ISO date to DD/MM/YYYY
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// === Main Component ===
export function CellStationDashboard() {
  const { toast } = useToast();
  const { 
    addRental, 
    addInventoryItem, 
    inventory: supabaseInventory,
    rentals: supabaseRentals,
    customers: supabaseCustomers,
    refreshData: refreshSupabaseData,
    addCustomer,
  } = useRental();

  const { simCards, isLoading: isLoadingSims, syncSims, isSyncing } = useCellstationSync();

  // State
  const [cellStationRentals, setCellStationRentals] = useState<CellStationRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active-rentals');

  // Activate form state
  const [selectedSim, setSelectedSim] = useState<SimCard | null>(null);

  // Replace form state
  const [selectedRental, setSelectedRental] = useState<CellStationRental | null>(null);
  const [newSim, setNewSim] = useState('');
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  // === Calculate smart stats ===
  const stats = useMemo((): Stats => {
    const today = new Date();
    
    let available = 0;
    let rented = 0;
    let overdue = 0;
    let expired = 0;
    let needsReplacement = 0;
    
    simCards.forEach(sim => {
      // Check if expired or inactive
      if (!sim.is_active) {
        expired++;
        return;
      }
      
      if (sim.expiry_date) {
        const expiryDate = parseISO(sim.expiry_date);
        if (expiryDate < today) {
          expired++;
          return;
        }
      }
      
      // Check main system status
      // sim_cards.local_number = UK (447429xxx)
      // sim_cards.israeli_number = Israeli (722587xxx)
      const normalizedSim = normalizeForSearch(sim.sim_number);
      const normalizedLocal = normalizeForSearch(sim.local_number); // UK
      const normalizedIsraeli = normalizeForSearch(sim.israeli_number); // Israeli
      
      const matchingItem = supabaseInventory.find(item => {
        const itemSimNorm = normalizeForSearch(item.simNumber);
        const itemLocalNorm = normalizeForSearch(item.localNumber); // UK
        const itemIsraeliNorm = normalizeForSearch(item.israeliNumber); // Israeli
        return (normalizedSim && itemSimNorm === normalizedSim) ||
               (normalizedLocal && itemLocalNorm === normalizedLocal) ||
               (normalizedIsraeli && itemIsraeliNorm === normalizedIsraeli) ||
               (normalizedIsraeli && itemLocalNorm === normalizedIsraeli);
      });
      
      if (matchingItem?.status === 'rented') {
        const activeRental = supabaseRentals.find(r => 
          r.status !== 'returned' &&
          r.items.some(item => item.inventoryItemId === matchingItem.id)
        );
        
        if (activeRental) {
          // SIM is available in CellStation but rented in main system = needs replacement
          if (!sim.is_rented) {
            needsReplacement++;
            return;
          }
          
          const isOverdue = activeRental.status === 'overdue' || 
            new Date(activeRental.endDate) < today;
          
          if (isOverdue) {
            overdue++;
          } else {
            rented++;
          }
          return;
        }
      }
      
      // Count as available
      if (sim.is_active && !sim.is_rented) {
        available++;
      } else if (sim.is_rented) {
        rented++;
      }
    });
    
    return { available, rented, overdue, expired, needsReplacement, total: simCards.length };
  }, [simCards, supabaseInventory, supabaseRentals]);

  // Fetch CellStation rentals data from Google Script
  const fetchCellStationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(WEBAPP_URL);
      const data = await res.json();

      if (data.success !== false) {
        setCellStationRentals(data.rentals || []);
      } else {
        setError(data.error || 'שגיאה בטעינת נתונים');
      }
    } catch (err) {
      setError('שגיאה בחיבור - לחץ על כפתור הסנכרון');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCellStationData();
  }, []);

  // Handle replace SIM
  const handleReplaceSim = (rental: CellStationRental) => {
    setSelectedRental(rental);
    setShowReplaceDialog(true);
  };

  const executeReplace = async () => {
    if (!selectedRental || !newSim || newSim.length < 19) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין מספר סים תקין (19-20 ספרות)',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch(WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace_sim',
          old_sim: selectedRental.sim,
          new_sim: newSim,
          rental_id: selectedRental.rental_id,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: '✅ החלפה נשמרה!',
          description: 'לחץ על הסימנייה באתר CellStation להשלמת ההחלפה',
        });
        setShowReplaceDialog(false);
        setSelectedRental(null);
        setNewSim('');
        fetchCellStationData();
      } else {
        throw new Error(data.error || 'שגיאה בהחלפה');
      }
    } catch (err: any) {
      toast({
        title: 'שגיאה',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Handle add to inventory
  const handleAddToInventory = async (sim: SimCard) => {
    if (!sim.sim_number) {
      toast({
        title: 'שגיאה',
        description: 'לסים זה אין מספר ICCID',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addInventoryItem({
        category: 'sim_european' as ItemCategory,
        name: `סים ${sim.local_number || sim.sim_number}`,
        localNumber: sim.local_number || undefined,
        israeliNumber: sim.israeli_number || undefined,
        expiryDate: sim.expiry_date || undefined,
        simNumber: sim.sim_number,
        status: 'available',
        notes: sim.package_name ? `חבילה: ${sim.package_name}` : undefined,
      });

      toast({
        title: 'נוסף למלאי',
        description: `הסים ${sim.local_number || sim.sim_number} נוסף בהצלחה`,
      });
    } catch (error) {
      console.error('Error adding SIM to inventory:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוסיף את הסים למלאי',
        variant: 'destructive',
      });
    }
  };

  // Handle activate - switch to activation tab with selected SIM
  const handleActivate = (sim: SimCard, requiresReplacement?: boolean, existingRental?: any) => {
    setSelectedSim(sim);
    setActiveTab('activation');
    // TODO: Pass requiresReplacement flag to ActivationTab if needed
  };

  const handleRefresh = async () => {
    await Promise.all([
      fetchCellStationData(),
      refreshSupabaseData(),
    ]);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-primary" />
            Cell Station
          </h1>
          <p className="text-muted-foreground">
            ניהול סימים חכם עם אינטגרציה מלאה
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={syncSims}
            disabled={isSyncing}
            variant="outline"
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            סנכרן מ-CellStation
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={loading || isLoadingSims}
            className="gap-2"
          >
            {loading || isLoadingSims ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            רענן
          </Button>
        </div>
      </div>

      {/* Smart Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard 
          title="זמינים להפעלה" 
          value={stats.available} 
          icon={CheckCircle} 
          variant="success"
          onClick={() => setActiveTab('available')}
        />
        <StatCard 
          title="צריך החלפה" 
          value={stats.needsReplacement} 
          icon={ArrowLeftRight} 
          variant="warning"
          highlight={stats.needsReplacement > 0}
          onClick={() => setActiveTab('needs-replacement')}
        />
        <StatCard 
          title="מושכרים" 
          value={stats.rented} 
          icon={Package} 
          variant="primary"
          onClick={() => setActiveTab('active-rentals')}
        />
        <StatCard 
          title="באיחור" 
          value={stats.overdue} 
          icon={AlertTriangle} 
          variant="destructive"
          highlight={stats.overdue > 0}
          onClick={() => setActiveTab('active-rentals')}
        />
        <StatCard 
          title="לא בתוקף" 
          value={stats.expired} 
          icon={XCircle} 
          variant="default"
          onClick={() => setActiveTab('expired')}
        />
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="available" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            זמינים ({stats.available})
          </TabsTrigger>
          <TabsTrigger value="needs-replacement" className="gap-2 relative">
            <ArrowLeftRight className="h-4 w-4" />
            צריך החלפה ({stats.needsReplacement})
            {stats.needsReplacement > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning" />
            )}
          </TabsTrigger>
          <TabsTrigger value="active-rentals" className="gap-2">
            <Package className="h-4 w-4" />
            מושכרים ({stats.rented})
          </TabsTrigger>
          <TabsTrigger value="expired" className="gap-2">
            <XCircle className="h-4 w-4" />
            לא בתוקף ({stats.expired})
          </TabsTrigger>
          <TabsTrigger value="all-sims" className="gap-2">
            <Smartphone className="h-4 w-4" />
            כל הסימים
          </TabsTrigger>
          <TabsTrigger value="activation" className="gap-2">
            <Zap className="h-4 w-4" />
            הפעלה חדשה
          </TabsTrigger>
        </TabsList>

        {/* Active Rentals Tab */}
        <TabsContent value="active-rentals">
          <ActiveRentalsTab
            rentals={cellStationRentals}
            supabaseRentals={supabaseRentals}
            supabaseInventory={supabaseInventory}
            isLoading={loading}
            onReplaceSim={handleReplaceSim}
          />
        </TabsContent>

        {/* Available SIMs Tab */}
        <TabsContent value="available">
          <AvailableSimsTab
            simCards={simCards}
            supabaseRentals={supabaseRentals}
            supabaseInventory={supabaseInventory}
            isLoading={isLoadingSims}
            onActivate={handleActivate}
            onAddToInventory={handleAddToInventory}
          />
        </TabsContent>

        {/* Needs Replacement Tab */}
        <TabsContent value="needs-replacement">
          <NeedsReplacementTab
            simCards={simCards}
            supabaseRentals={supabaseRentals}
            supabaseInventory={supabaseInventory}
            isLoading={isLoadingSims}
            onActivate={handleActivate}
          />
        </TabsContent>

        {/* All SIMs Tab */}
        <TabsContent value="all-sims">
          <AllSimsTab
            simCards={simCards}
            supabaseRentals={supabaseRentals}
            supabaseInventory={supabaseInventory}
            isLoading={isLoadingSims}
          />
        </TabsContent>

        {/* Expired SIMs Tab */}
        <TabsContent value="expired">
          <ExpiredSimsTab
            simCards={simCards}
            isLoading={isLoadingSims}
          />
        </TabsContent>

        {/* Activation Tab */}
        <TabsContent value="activation">
          <ActivationTab
            simCards={simCards}
            customers={supabaseCustomers}
            inventory={supabaseInventory}
            selectedSim={selectedSim}
            onSimChange={setSelectedSim}
            addCustomer={addCustomer}
            addInventoryItem={addInventoryItem}
            addRental={addRental}
          />
        </TabsContent>
      </Tabs>

      {/* Replace SIM Dialog */}
      <Dialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              החלפת סים בהשכרה
            </DialogTitle>
            <DialogDescription>
              הסים הישן יוחלף בסים חדש. הפעולה לא הפיכה.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRental && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-1 text-sm">
                  <div><strong>לקוח:</strong> {selectedRental.customer_name}</div>
                  <div><strong>טלפון:</strong> {formatPhone(selectedRental.customer_phone)}</div>
                  <div><strong>סים נוכחי:</strong> {selectedRental.local_number}</div>
                  <div><strong>תאריכים:</strong> {formatDate(selectedRental.start_date)} - {formatDate(selectedRental.end_date)}</div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <label className="block font-medium text-sm">מספר סים חדש (ICCID):</label>
                <Input
                  value={newSim}
                  onChange={(e) => setNewSim(e.target.value.replace(/\D/g, ''))}
                  className="font-mono"
                  placeholder="19-20 ספרות"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  {newSim.length}/20 ספרות
                  {newSim.length >= 19 && newSim.length <= 20 && ' ✅'}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                <span>לאחר הלחיצה, לחץ על הסימנייה באתר CellStation להשלמת ההחלפה</span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={executeReplace}
                  disabled={newSim.length < 19}
                  className="flex-1 gap-2"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  החלף סים
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReplaceDialog(false)}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CellStationDashboard;

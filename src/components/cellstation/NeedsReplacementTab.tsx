import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Smartphone,
  Zap,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowLeftRight,
  User,
  Calendar,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { SimCard } from '@/hooks/useCellstationSync';
import { Rental as SupabaseRental, InventoryItem } from '@/types/rental';

interface NeedsReplacementTabProps {
  simCards: SimCard[];
  supabaseRentals: SupabaseRental[];
  supabaseInventory: InventoryItem[];
  isLoading: boolean;
  onActivate: (sim: SimCard, requiresReplacement: boolean, existingRental?: SupabaseRental) => void;
}

interface SimWithRentalInfo extends SimCard {
  matchingInventoryItem?: InventoryItem;
  activeRental?: SupabaseRental;
  isOverdue?: boolean;
}

export function NeedsReplacementTab({
  simCards,
  supabaseRentals,
  supabaseInventory,
  isLoading,
  onActivate,
}: NeedsReplacementTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sim: SimWithRentalInfo | null;
  }>({ open: false, sim: null });

  // Find SIMs that are available in CellStation but still rented in main system
  const simsNeedingReplacement = useMemo((): SimWithRentalInfo[] => {
    const today = new Date();
    
    return simCards
      .filter(sim => {
        // Must be active in CellStation
        if (!sim.is_active) return false;
        
        // Must not be rented in CellStation (available there)
        if (sim.is_rented) return false;
        
        // Must have valid expiry
        if (sim.expiry_date) {
          const expiryDate = parseISO(sim.expiry_date);
          if (expiryDate < today) return false;
        }
        
        return true;
      })
      .map(sim => {
        // Normalize for matching
        const simNorm = normalizeForSearch(sim.sim_number);
        const localNorm = normalizeForSearch(sim.local_number);
        const israeliNorm = normalizeForSearch(sim.israeli_number);
        
        // Find matching inventory item
        const matchingItem = supabaseInventory.find(item => {
          const itemSimNorm = normalizeForSearch(item.simNumber);
          const itemLocalNorm = normalizeForSearch(item.localNumber);
          const itemIsraeliNorm = normalizeForSearch(item.israeliNumber);
          
          return (simNorm && itemSimNorm === simNorm) ||
                 (localNorm && itemLocalNorm === localNorm) ||
                 (israeliNorm && itemIsraeliNorm === israeliNorm) ||
                 (israeliNorm && itemLocalNorm === israeliNorm);
        });
        
        if (!matchingItem || matchingItem.status !== 'rented') {
          return null;
        }
        
        // Find active rental for this item
        const activeRental = supabaseRentals.find(r => 
          r.status !== 'returned' &&
          r.items.some(item => item.inventoryItemId === matchingItem.id)
        );
        
        if (!activeRental) return null;
        
        const isOverdue = activeRental.status === 'overdue' || 
          new Date(activeRental.endDate) < today;
        
        return {
          ...sim,
          matchingInventoryItem: matchingItem,
          activeRental,
          isOverdue,
        } as SimWithRentalInfo;
      })
      .filter((sim): sim is SimWithRentalInfo => sim !== null);
  }, [simCards, supabaseInventory, supabaseRentals]);

  // Apply search filter
  const filteredSims = useMemo(() => {
    if (!searchTerm) return simsNeedingReplacement;
    
    const searchNormalized = normalizeForSearch(searchTerm);
    return simsNeedingReplacement.filter(sim => {
      const localNorm = normalizeForSearch(sim.local_number);
      const israeliNorm = normalizeForSearch(sim.israeli_number);
      const simNorm = normalizeForSearch(sim.sim_number);
      const customerNorm = sim.activeRental?.customerName?.toLowerCase() || '';
      
      return localNorm.includes(searchNormalized) ||
             israeliNorm.includes(searchNormalized) ||
             simNorm.includes(searchNormalized) ||
             customerNorm.includes(searchNormalized.toLowerCase());
    });
  }, [simsNeedingReplacement, searchTerm]);

  // Get expiry status
  const getExpiryStatus = (expiryDate: string | null): { color: string; text: string; daysLeft: number } => {
    if (!expiryDate) return { color: 'text-muted-foreground', text: 'לא ידוע', daysLeft: 999 };
    
    const today = new Date();
    const expiry = parseISO(expiryDate);
    const daysLeft = differenceInDays(expiry, today);
    
    if (daysLeft <= 7) {
      return { color: 'text-destructive', text: `${daysLeft} ימים`, daysLeft };
    } else if (daysLeft <= 30) {
      return { color: 'text-warning', text: `${daysLeft} ימים`, daysLeft };
    }
    return { color: 'text-success', text: `${daysLeft} ימים`, daysLeft };
  };

  const handleActivateClick = (sim: SimWithRentalInfo) => {
    setConfirmDialog({ open: true, sim });
  };

  const handleConfirmActivation = () => {
    if (confirmDialog.sim) {
      onActivate(confirmDialog.sim, true, confirmDialog.sim.activeRental);
    }
    setConfirmDialog({ open: false, sim: null });
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <Card className="border-warning/50 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium">סימים הצריכים החלפה</p>
              <p className="text-sm text-muted-foreground">
                סימים אלו פנויים באתר CellStation אבל עדיין מושכרים במערכת שלך.
                בעת הפעלה, יש לבצע החלפת סים בהשכרה הקיימת.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="🔍 חיפוש לפי מספר או שם לקוח..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* SIM Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSims.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין סימים הצריכים החלפה</p>
          <p className="text-sm mt-2">
            כל הסימים הפנויים תואמים לסטטוס במערכת הראשית
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSims.map((sim) => {
            const expiryStatus = getExpiryStatus(sim.expiry_date);
            
            return (
              <Card 
                key={sim.id} 
                className={cn(
                  "glass-card border-warning/50 bg-warning/5 hover:shadow-lg transition-all duration-200",
                  sim.isOverdue && "border-destructive/50 bg-destructive/5"
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className={cn(
                        "h-4 w-4",
                        sim.isOverdue ? "text-destructive" : "text-warning"
                      )} />
                      <span className="font-mono font-bold">
                        {sim.local_number || sim.sim_number?.slice(-6) || 'N/A'}
                      </span>
                    </div>
                    <Badge 
                      variant={sim.isOverdue ? "destructive" : "warning"} 
                      className="gap-1"
                    >
                      {sim.isOverdue ? (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          באיחור!
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          צריך החלפה
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* Current rental info */}
                  {sim.activeRental && (
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4 text-primary" />
                        <span>השכרה נוכחית:</span>
                      </div>
                      <div className="text-sm space-y-1 mr-6">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">לקוח:</span>
                          <span className="font-medium">{sim.activeRental.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">סיום:</span>
                          <span className={cn(
                            "font-medium",
                            sim.isOverdue && "text-destructive"
                          )}>
                            {format(parseISO(sim.activeRental.endDate), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SIM Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">🇮🇱 ישראלי:</span>
                      <span className="font-mono">{sim.israeli_number || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">📅 תוקף:</span>
                      <span className={cn("font-medium", expiryStatus.color)}>
                        {sim.expiry_date 
                          ? `${format(parseISO(sim.expiry_date), 'dd/MM/yyyy')} (${expiryStatus.text})`
                          : 'לא ידוע'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-24">📦 חבילה:</span>
                      <span>{sim.package_name || '-'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border/50">
                    <Button
                      className="w-full gap-2"
                      variant={sim.isOverdue ? "destructive" : "default"}
                      onClick={() => handleActivateClick(sim)}
                    >
                      <Zap className="h-4 w-4" />
                      הפעל + החלף סים
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, sim: null })}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              אישור הפעלה עם החלפת סים
            </DialogTitle>
            <DialogDescription className="text-right">
              סים זה עדיין מושכר במערכת על שם{' '}
              <span className="font-bold text-foreground">
                {confirmDialog.sim?.activeRental?.customerName}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-sm">
                ⚠️ <strong>שים לב:</strong> לאחר ההפעלה, יש לבצע החלפת סים בהשכרה הקיימת כדי לסנכרן את המערכות.
              </p>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">מספר UK:</span>
                <span className="font-mono">{confirmDialog.sim?.local_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">מספר ישראלי:</span>
                <span className="font-mono">{confirmDialog.sim?.israeli_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">תוקף סיום השכרה:</span>
                <span>
                  {confirmDialog.sim?.activeRental?.endDate 
                    ? format(parseISO(confirmDialog.sim.activeRental.endDate), 'dd/MM/yyyy')
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog({ open: false, sim: null })}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleConfirmActivation}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              הפעל בכל זאת
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRental } from '@/hooks/useRental';
import { useToast } from '@/hooks/use-toast';
import { calculateAmericanSimPrice } from '@/lib/pricing';
import { differenceInDays, format, addDays } from 'date-fns';
import { PACKAGE_LABELS, USSim, Rental } from '@/types/rental';

// EnrichedUSSim extends USSim with rental/customer data derived from the main rentals list
export interface EnrichedUSSim extends USSim {
  linkedRental: Rental | null;
  customerName: string | null;
  rentalEndDate: string | null;
  isRented: boolean;
  isOverdue: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
}

interface Props {
  sim: EnrichedUSSim;
  isOpen: boolean;
  onClose: () => void;
}

export function USSimQuickRentalDialog({ sim, isOpen, onClose }: Props) {
  const { customers, addRental } = useRental();
  const { toast } = useToast();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const [customerId, setCustomerId] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextWeekStr);
  const [isSaving, setIsSaving] = useState(false);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const d = differenceInDays(new Date(endDate), new Date(startDate));
    return Math.max(d, 1);
  }, [startDate, endDate]);

  const price = useMemo(
    () => calculateAmericanSimPrice(days, sim.includesIsraeliNumber ?? false),
    [days, sim.includesIsraeliNumber]
  );

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleSubmit = async () => {
    if (!customerId || !startDate || !endDate || days <= 0) return;
    setIsSaving(true);

    const simName = `${sim.simCompany}${
      sim.package ? ` – ${PACKAGE_LABELS[sim.package] ?? sim.package}` : ''
    }`;

    try {
      await addRental({
        customerId,
        customerName: selectedCustomer?.name ?? '',
        startDate,
        endDate,
        totalPrice: price,
        currency: 'USD',
        status: 'active',
        items: [
          {
            inventoryItemId: `us-sim-${sim.id}`,
            itemCategory: 'sim_american',
            itemName: simName,
            hasIsraeliNumber: sim.includesIsraeliNumber ?? false,
            isGeneric: false,
          },
        ],
      });
      toast({
        title: '✅ השכרה נוצרה',
        description: `${simName} הושכר ל-${selectedCustomer?.name}`,
      });
      handleClose();
    } catch (err: any) {
      toast({
        title: 'שגיאה',
        description: err.message ?? 'שגיאה ביצירת השכרה',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCustomerId('');
    setStartDate(todayStr);
    setEndDate(nextWeekStr);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🇺🇸 השכרת סים – {sim.simCompany}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SIM info summary */}
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1 border border-border/30">
            {sim.localNumber && (
              <div dir="ltr" className="font-mono text-xs">
                📱 {sim.localNumber}
              </div>
            )}
            {sim.israeliNumber && (
              <div dir="ltr" className="font-mono text-xs">
                🇮🇱 {sim.israeliNumber}
              </div>
            )}
            {sim.package && (
              <div className="text-muted-foreground text-xs">
                {PACKAGE_LABELS[sim.package]}
              </div>
            )}
            {sim.expiryDate && (
              <div className="text-muted-foreground text-xs">
                תוקף:{' '}
                {format(new Date(sim.expiryDate), 'dd/MM/yyyy')}
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-1.5">
            <Label>לקוח</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>תאריך תחילה</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>תאריך סיום</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                dir="ltr"
                min={startDate}
              />
            </div>
          </div>

          {/* Price preview */}
          {days > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm flex justify-between items-center">
              <span className="text-muted-foreground">{days} ימים</span>
              <span className="font-bold text-primary text-base">${price} USD</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            ביטול
          </Button>
          <Button
            variant="glow"
            onClick={handleSubmit}
            disabled={isSaving || !customerId || !startDate || !endDate || days <= 0}
          >
            {isSaving ? 'יוצר...' : 'צור השכרה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

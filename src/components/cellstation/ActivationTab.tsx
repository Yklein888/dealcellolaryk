import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarIcon, Search, UserPlus, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { calculateRentalPrice } from '@/lib/pricing';
import { useRental } from '@/hooks/useRental';
import { useToast } from '@/hooks/use-toast';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
}

interface ActivationTabProps {
  availableSims: CellStationSim[];
  onActivate: (params: any) => Promise<any>;
  isActivating: boolean;
}

const NOTE_TEMPLATES = ['VIP', 'עסקי', 'משפחה', 'חוזר'];

export function ActivationTab({ availableSims, onActivate, isActivating }: ActivationTabProps) {
  const { customers, addCustomer, addRental, inventory } = useRental();
  const { toast } = useToast();

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSimId, setSelectedSimId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [simSearch, setSimSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 10);
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(customerSearch)
    ).slice(0, 10);
  }, [customers, customerSearch]);

  const filteredSims = useMemo(() => {
    const available = availableSims.filter(s => s.status === 'available');
    if (!simSearch.trim()) return available;
    const q = simSearch.toLowerCase();
    return available.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid, s.plan]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [availableSims, simSearch]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedSim = availableSims.find(s => s.id === selectedSimId);

  const pricePreview = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    // Default to European SIM pricing
    return calculateRentalPrice(
      [{ category: 'sim_european' }],
      start, end
    );
  }, [startDate, endDate]);

  const handleQuickAdd = async () => {
    if (!quickName || !quickPhone) return;
    try {
      await addCustomer({ name: quickName, phone: quickPhone });
      toast({ title: 'לקוח נוסף בהצלחה' });
      setQuickAddOpen(false);
      setQuickName('');
      setQuickPhone('');
    } catch {
      toast({ title: 'שגיאה', variant: 'destructive' });
    }
  };

  const handleActivate = async () => {
    if (!selectedCustomer || !selectedSim || !startDate || !endDate) {
      toast({ title: 'יש למלא את כל השדות', variant: 'destructive' });
      return;
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const days = differenceInDays(endDate, startDate) + 1;

    try {
      // 1. Activate on CellStation portal
      await onActivate({
        product: selectedSim.plan || '',
        start_rental: format(startDate, 'dd/MM/yyyy'),
        end_rental: format(endDate, 'dd/MM/yyyy'),
        price: pricePreview?.total?.toString() || '0',
        days: days.toString(),
        note: `${selectedCustomer.name} ${selectedCustomer.phone} ${notes}`.trim(),
      });

      // 2. Find matching inventory item by ICCID
      const matchingItem = inventory.find(i => i.simNumber === selectedSim.iccid);

      // 3. Create rental
      await addRental({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items: [{
          inventoryItemId: matchingItem?.id || selectedSim.id,
          itemCategory: 'sim_european',
          itemName: `סים ${selectedSim.uk_number || selectedSim.il_number || selectedSim.iccid}`,
          hasIsraeliNumber: !!selectedSim.il_number,
          isGeneric: !matchingItem,
        }],
        startDate: startStr,
        endDate: endStr,
        totalPrice: pricePreview?.total || 0,
        currency: pricePreview?.currency || 'ILS',
        status: 'active',
        notes: notes || undefined,
      });

      toast({ title: 'הסים הופעל והשכרה נוצרה בהצלחה!' });
      // Reset form
      setSelectedCustomerId('');
      setSelectedSimId('');
      setStartDate(undefined);
      setEndDate(undefined);
      setNotes('');
    } catch (e: any) {
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
    }
  };

  const getSimBorderColor = (sim: CellStationSim) => {
    switch (sim.status_detail) {
      case 'valid': return 'border-green-400 dark:border-green-600';
      case 'expiring': return 'border-yellow-400 dark:border-yellow-600';
      case 'expired': return 'border-red-400 dark:border-red-600';
      default: return 'border-border';
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              בחירת לקוח
              <Button size="sm" variant="outline" onClick={() => setQuickAddOpen(true)}>
                <UserPlus className="h-4 w-4 ml-1" />
                חדש
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לקוח..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={cn(
                    'w-full text-right p-2 rounded-md text-sm transition-colors',
                    selectedCustomerId === c.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs mr-2 opacity-70">{c.phone}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SIM Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">בחירת סים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש סים..."
                value={simSearch}
                onChange={e => setSimSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredSims.map(sim => (
                <button
                  key={sim.id}
                  onClick={() => setSelectedSimId(sim.id)}
                  className={cn(
                    'w-full text-right p-2 rounded-md text-sm border-2 transition-colors',
                    getSimBorderColor(sim),
                    selectedSimId === sim.id
                      ? 'bg-primary/10 ring-2 ring-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sim.status_detail === 'expired' && (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {sim.plan || 'ללא חבילה'}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                      <span className="text-[10px] mr-2 text-muted-foreground">
                        ...{sim.iccid?.slice(-6)}
                      </span>
                    </div>
                  </div>
                  {sim.status_detail === 'expired' && (
                    <p className="text-[10px] text-red-500 mt-1">
                      סים פג תוקף - יש להאריך לפני הפעלה
                    </p>
                  )}
                </button>
              ))}
              {filteredSims.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">אין סימים זמינים</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dates & Price */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>תאריך התחלה</Label>
          <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-right">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, 'dd/MM/yyyy') : 'בחר תאריך'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setIsStartOpen(false); }} locale={he} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>תאריך סיום</Label>
          <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-right">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {endDate ? format(endDate, 'dd/MM/yyyy') : 'בחר תאריך'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setIsEndOpen(false); }} locale={he} disabled={(d) => startDate ? d < startDate : false} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>מחיר מחושב</Label>
          <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50">
            {pricePreview ? (
              <span className="font-bold text-lg">
                {pricePreview.currency === 'ILS' ? '₪' : '$'}{pricePreview.total}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">בחר תאריכים</span>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>הערות</Label>
        <div className="flex gap-2 flex-wrap mb-2">
          {NOTE_TEMPLATES.map(t => (
            <Button
              key={t}
              size="sm"
              variant={notes.includes(t) ? 'default' : 'outline'}
              onClick={() => setNotes(prev => prev.includes(t) ? prev.replace(t, '').trim() : `${prev} ${t}`.trim())}
              className="text-xs"
            >
              {t}
            </Button>
          ))}
        </div>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="הערות נוספות..."
          rows={2}
        />
      </div>

      {/* Activate Button */}
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleActivate}
        disabled={isActivating || !selectedCustomerId || !selectedSimId || !startDate || !endDate}
      >
        {isActivating ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> מפעיל...</>
        ) : (
          <><Zap className="h-4 w-4" /> הפעל סים</>
        )}
      </Button>

      {/* Quick Add Customer Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>הוספת לקוח חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>שם</Label>
              <Input value={quickName} onChange={e => setQuickName(e.target.value)} />
            </div>
            <div>
              <Label>טלפון</Label>
              <Input value={quickPhone} onChange={e => setQuickPhone(e.target.value)} dir="ltr" />
            </div>
            <Button onClick={handleQuickAdd} className="w-full">הוסף לקוח</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

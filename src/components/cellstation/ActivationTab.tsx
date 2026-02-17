import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Checkbox } from '@/components/ui/checkbox';
import { format, differenceInDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { CalendarIcon, Search, UserPlus, Loader2, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
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
  customer_name: string | null;
}

interface ActivationTabProps {
  availableSims: CellStationSim[];
  onActivate: (params: any) => Promise<any>;
  onActivateAndSwap: (params: any, onProgress?: (step: string, percent: number) => void) => Promise<any>;
  isActivating: boolean;
}

const NOTE_TEMPLATES = ['VIP', 'עסקי', 'משפחה', 'חוזר'];

export function ActivationTab({ availableSims, onActivate, onActivateAndSwap, isActivating }: ActivationTabProps) {
  const { customers, addCustomer, addRental, addInventoryItem, inventory } = useRental();
  const { toast } = useToast();

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSimIds, setSelectedSimIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [simSearch, setSimSearch] = useState('');
  const [includeDevice, setIncludeDevice] = useState(false);

  // Old SIM selection for activate+swap
  const [oldSimSearch, setOldSimSearch] = useState('');
  const [selectedOldSimId, setSelectedOldSimId] = useState('');
  const [showOldSimSection, setShowOldSimSection] = useState(false);
  const [manualOldIccid, setManualOldIccid] = useState('');
  const [useManualOldSim, setUseManualOldSim] = useState(false);

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

  // Old SIMs = currently rented SIMs (for swap)
  const filteredOldSims = useMemo(() => {
    const rented = availableSims.filter(s => s.status === 'rented');
    if (!oldSimSearch.trim()) return rented;
    const q = oldSimSearch.toLowerCase();
    return rented.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid, s.customer_name]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [availableSims, oldSimSearch]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedSims = availableSims.filter(s => selectedSimIds.includes(s.id));
  const selectedOldSim = availableSims.find(s => s.id === selectedOldSimId);

  const toggleSimSelection = (simId: string) => {
    setSelectedSimIds(prev =>
      prev.includes(simId) ? prev.filter(id => id !== simId) : [...prev, simId]
    );
  };

  const pricePreview = useMemo(() => {
    if (!startDate || !endDate || selectedSimIds.length === 0) return null;
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(endDate, 'yyyy-MM-dd');
    const simItems = selectedSimIds.map((_, i) => ({
      category: 'sim_european' as const,
      includeEuropeanDevice: includeDevice && i === 0,
    }));
    return calculateRentalPrice(simItems, start, end);
  }, [startDate, endDate, includeDevice, selectedSimIds]);

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

  const handleSimpleActivate = async () => {
    if (!selectedCustomer || selectedSimIds.length === 0 || !startDate || !endDate) {
      toast({ title: 'יש למלא את כל השדות', variant: 'destructive' });
      return;
    }

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const days = differenceInDays(endDate, startDate) + 1;

    try {
      const rentalItems: any[] = [];

      for (const sim of selectedSims) {
        const cleanIccid = sim.iccid?.replace(/\D/g, '') || '';
        console.log('Activating SIM ICCID:', cleanIccid);

        const activationParams = {
          iccid: cleanIccid,
          product: sim.plan || '',
          start_rental: format(startDate, 'dd/MM/yyyy'),
          end_rental: format(endDate, 'dd/MM/yyyy'),
          price: '0',
          days: days.toString(),
          note: `${selectedCustomer.name} ${selectedCustomer.phone} ${notes}`.trim(),
        };

        const activationResult = await onActivate(activationParams);
        console.log('Activation response for', cleanIccid, ':', activationResult?.success);

        // Find or create inventory item
        const { data: existingItem } = await supabase
          .from('inventory')
          .select('*')
          .eq('sim_number', sim.iccid)
          .single();

        let inventoryItemId: string;

        if (!existingItem) {
          const { data: newItem, error: insertErr } = await supabase.from('inventory').insert({
            name: `סים גלישה`,
            category: 'sim_european',
            sim_number: sim.iccid,
            local_number: sim.uk_number || null,
            israeli_number: sim.il_number || null,
            expiry_date: sim.expiry_date || null,
            status: 'available',
          }).select('id').single();
          if (insertErr) throw new Error(`Failed to create inventory item: ${insertErr.message}`);
          inventoryItemId = newItem.id;
        } else {
          inventoryItemId = existingItem.id;
          if (existingItem.status !== 'available') {
            await supabase.from('inventory')
              .update({ status: 'available' })
              .eq('id', existingItem.id);
          }
        }

        rentalItems.push({
          inventoryItemId,
          itemCategory: 'sim_european' as const,
          itemName: `סים ${sim.uk_number || sim.il_number || sim.iccid}`,
          hasIsraeliNumber: !!sim.il_number,
          isGeneric: false,
        });

        // Update cellstation_sims status
        if (sim.iccid) {
          await supabase
            .from('cellstation_sims')
            .update({ status: 'rented', customer_name: selectedCustomer.name })
            .eq('iccid', sim.iccid);
        }
      }

      // Add bundled device if selected
      if (includeDevice) {
        rentalItems.push({
          inventoryItemId: '',
          itemCategory: 'device_simple' as const,
          itemName: 'מכשיר פשוט (באנדל)',
          isGeneric: true,
          pricePerDay: 5,
        });
      }

      await addRental({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items: rentalItems,
        startDate: startStr,
        endDate: endStr,
        totalPrice: pricePreview?.total || 0,
        currency: pricePreview?.currency || 'ILS',
        status: 'active',
        notes: notes || undefined,
      });

      toast({ title: `${selectedSims.length} סימים הופעלו והשכרה נוצרה בהצלחה!` });
      resetForm();
    } catch (e: any) {
      console.error('Activation error:', e);
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
    }
  };

  const handleActivateAndSwap = async () => {
    const hasOldSim = useManualOldSim ? (manualOldIccid.replace(/\D/g, '').length >= 19) : !!selectedOldSimId;
    if (!selectedCustomer || selectedSimIds.length === 0 || !hasOldSim || !startDate || !endDate) {
      toast({ title: 'יש למלא את כל השדות כולל סים ישן', variant: 'destructive' });
      return;
    }

    const oldIccid = useManualOldSim
      ? manualOldIccid.replace(/\D/g, '')
      : (selectedOldSim?.iccid?.replace(/\D/g, '') || '');
    const oldSimNumber = useManualOldSim ? '' : (selectedOldSim?.sim_number || '');

    try {
      const activeSim = selectedSims[0];
      if (!activeSim) return;
      const swapParams = {
        product: activeSim.plan || '',
        start_rental: format(startDate, 'dd/MM/yyyy'),
        end_rental: format(endDate, 'dd/MM/yyyy'),
        price: pricePreview?.total?.toString() || '0',
        note: `${selectedCustomer.name} ${selectedCustomer.phone} ${notes}`.trim(),
        rental_id: '',
        current_sim: oldSimNumber,
        current_iccid: oldIccid,
        swap_msisdn: activeSim.uk_number || '',
        swap_iccid: activeSim.iccid?.replace(/\D/g, '') || '',
      };
      console.log('Activate+Swap params:', JSON.stringify(swapParams, null, 2));

      const swapResult = await onActivateAndSwap(swapParams);
      console.log('Activate+Swap response:', JSON.stringify(swapResult, null, 2));

      toast({ title: 'הפעלה והחלפה הושלמו בהצלחה!' });
      resetForm();
    } catch (e: any) {
      console.error('Activate+Swap error:', e);
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedSimIds([]);
    setSelectedOldSimId('');
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
    setShowOldSimSection(false);
    setIncludeDevice(false);
    setManualOldIccid('');
    setUseManualOldSim(false);
  };

  const getSimBorderColor = (sim: CellStationSim) => {
    switch (sim.status_detail) {
      case 'valid': return 'border-green-400 dark:border-green-600';
      case 'expiring': return 'border-yellow-400 dark:border-yellow-600';
      case 'expired': return 'border-red-400 dark:border-red-600';
      default: return 'border-border';
    }
  };

  const canActivate = selectedCustomerId && selectedSimIds.length > 0 && startDate && endDate;
  const hasValidOldSim = useManualOldSim
    ? (manualOldIccid.replace(/\D/g, '').length >= 19)
    : !!selectedOldSimId;
  const canActivateAndSwap = canActivate && hasValidOldSim;

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

        {/* SIM Selection - Multi Select */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>בחירת סימים להפעלה</span>
              {selectedSimIds.length > 0 && (
                <Badge variant="secondary">{selectedSimIds.length} נבחרו</Badge>
              )}
            </CardTitle>
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
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredSims.map(sim => {
                const isSelected = selectedSimIds.includes(sim.id);
                return (
                  <button
                    key={sim.id}
                    onClick={() => toggleSimSelection(sim.id)}
                    className={cn(
                      'w-full text-right p-2 rounded-md text-sm border-2 transition-colors',
                      getSimBorderColor(sim),
                      isSelected
                        ? 'bg-primary/10 ring-2 ring-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        {sim.status_detail === 'expired' && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {sim.plan || 'ללא חבילה'}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                        <span className="text-[10px] mr-2 text-muted-foreground font-mono">
                          {sim.iccid || '---'}
                        </span>
                      </div>
                    </div>
                    {sim.status_detail === 'expired' && (
                      <p className="text-[10px] text-destructive mt-1">
                        סים פג תוקף - יש להאריך לפני הפעלה
                      </p>
                    )}
                  </button>
                );
              })}
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
                {selectedSimIds.length > 1 && (
                  <span className="text-xs font-normal text-muted-foreground mr-2">
                    ({selectedSimIds.length} סימים)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">בחר תאריכים וסימים</span>
            )}
          </div>
        </div>
      </div>

      {/* European Bundle - Include Device */}
      <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
        <Checkbox
          id="include-device"
          checked={includeDevice}
          onCheckedChange={(checked) => setIncludeDevice(checked === true)}
        />
        <Label htmlFor="include-device" className="cursor-pointer flex-1">
          <span className="font-medium">הוסף מכשיר פשוט (באנדל)</span>
          <span className="text-xs text-muted-foreground block">
            ₪5 ליום עסקים · חיוב מהיום הבא
          </span>
        </Label>
        {includeDevice && pricePreview && pricePreview.breakdown.length > 1 && (
          <span className="text-sm font-medium text-primary">
            +₪{pricePreview.breakdown[pricePreview.breakdown.length - 1]?.price || 0}
          </span>
        )}
      </div>

      {/* Price breakdown */}
      {pricePreview && pricePreview.breakdown.length > 1 && (
        <div className="text-xs text-muted-foreground space-y-1 px-1">
          {pricePreview.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between">
              <span>{b.currency}{b.price}</span>
              <span>{b.item} {b.details ? `(${b.details})` : ''}</span>
            </div>
          ))}
          <div className="flex justify-between font-medium text-foreground border-t pt-1">
            <span>₪{pricePreview.total}</span>
            <span>סה״כ</span>
          </div>
        </div>
      )}

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

      {/* Old SIM Section (for activate+swap) */}
      {!showOldSimSection ? (
        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={() => setShowOldSimSection(true)}
        >
          + בחר סים ישן להחלפה (אופציונלי - הפעלה + החלפה)
        </Button>
      ) : (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                בחירת סים ישן להחלפה
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setShowOldSimSection(false); setSelectedOldSimId(''); }}>
                ביטול
              </Button>
            </CardTitle>
          </CardHeader>
           <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש סים מושכר..."
                value={oldSimSearch}
                onChange={e => setOldSimSearch(e.target.value)}
                className="pr-10"
                onFocus={() => setUseManualOldSim(false)}
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredOldSims.map(sim => (
                <button
                  key={sim.id}
                  onClick={() => {
                    setSelectedOldSimId(sim.id);
                    setUseManualOldSim(false);
                    setManualOldIccid('');
                  }}
                  className={cn(
                    'w-full text-right p-2 rounded-md text-sm border transition-colors',
                    selectedOldSimId === sim.id && !useManualOldSim
                      ? 'bg-orange-100 dark:bg-orange-950/30 border-orange-400 ring-1 ring-orange-400'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{sim.customer_name || ''}</span>
                    <div>
                      <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                      <span className="text-[10px] mr-2 text-muted-foreground">...{sim.iccid?.slice(-6)}</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredOldSims.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">אין סימים מושכרים</p>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t" />
              <span className="text-xs text-muted-foreground">או</span>
              <div className="flex-1 border-t" />
            </div>

            {/* Manual ICCID Input */}
            <div className="space-y-2">
              <Label>הכנס ICCID ידנית (19-20 ספרות)</Label>
              <Input
                value={manualOldIccid}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setManualOldIccid(val);
                  if (val) {
                    setUseManualOldSim(true);
                    setSelectedOldSimId('');
                  }
                }}
                placeholder="89..."
                dir="ltr"
                className={cn(
                  "font-mono",
                  useManualOldSim && manualOldIccid ? 'ring-1 ring-orange-400 border-orange-400' : ''
                )}
                maxLength={20}
              />
              {manualOldIccid && useManualOldSim && manualOldIccid.length < 19 && (
                <p className="text-xs text-destructive">ICCID חייב להיות 19-20 ספרות</p>
              )}
              {manualOldIccid && useManualOldSim && manualOldIccid.length >= 19 && (
                <p className="text-xs text-green-600">✓ ICCID תקין</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {/* Simple Activate */}
        <Button
          size="lg"
          className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleSimpleActivate}
          disabled={isActivating || !canActivate}
        >
          {isActivating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> מפעיל...</>
          ) : (
            <><CheckCircle className="h-4 w-4" /> הפעל {selectedSimIds.length > 1 ? `${selectedSimIds.length} סימים` : 'סים'}</>
          )}
        </Button>

        {/* Activate + Swap (only when old SIM selected) */}
        {showOldSimSection && hasValidOldSim && (
          <Button
            size="lg"
            className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleActivateAndSwap}
            disabled={isActivating || !canActivateAndSwap}
          >
            {isActivating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> מפעיל...</>
            ) : (
              <><Zap className="h-4 w-4" /> הפעל + החלף סים</>
            )}
          </Button>
        )}
      </div>

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

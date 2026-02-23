import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle, Search, X, User, Printer, Smartphone } from 'lucide-react';

interface SimRow {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  expiry_date: string | null;
  plan: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_name: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface InventoryDevice {
  id: string;
  name: string;
  category: string;
  price: number | null;
}

interface QuickRentalDialogProps {
  sim: SimRow | null;
  isOpen: boolean;
  onClose: () => void;
  onActivate: (sim: SimRow, params: {
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => Promise<any>;
  onSuccess?: () => void;
}

export function QuickRentalDialog({ sim, isOpen, onClose, onActivate, onSuccess }: QuickRentalDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Customer search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [manualName, setManualName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Device selection
  const [devices, setDevices] = useState<InventoryDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<InventoryDevice | null>(null);

  // Rental details
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [simDailyRate, setSimDailyRate] = useState('');
  const [deviceDailyRate, setDeviceDailyRate] = useState('');

  // Async state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdRentalId, setCreatedRentalId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const days = Math.max(1, Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ));

  const simTotal = Math.round((parseFloat(simDailyRate) || 0) * days);
  const deviceTotal = Math.round((parseFloat(deviceDailyRate) || 0) * days);
  const totalPrice = simTotal + deviceTotal;

  // Fetch available devices when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('inventory' as any)
      .select('id, name, category, price')
      .in('category', ['device_simple', 'device_smartphone'])
      .eq('status', 'available')
      .order('name')
      .then(({ data }) => setDevices((data as InventoryDevice[]) || []));
  }, [isOpen]);

  // Auto-fill device daily rate from inventory price
  useEffect(() => {
    if (selectedDevice?.price) {
      setDeviceDailyRate(String(selectedDevice.price));
    } else {
      setDeviceDailyRate('');
    }
  }, [selectedDevice]);

  // Debounced customer search
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('customers')
          .select('id, name, phone')
          .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
          .limit(8);
        setSearchResults((data as Customer[]) || []);
        setDropdownOpen(true);
      } catch (e) {
        console.error('Customer search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handlePrint = () => {
    const customerName = selectedCustomer?.name || manualName;
    const simLabel = sim?.uk_number || sim?.il_number || sim?.sim_number || sim?.iccid || '';
    const deviceName = selectedDevice?.name || '';
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>הוראות שימוש בסים</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; direction: rtl; }
          h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
          h2 { font-size: 16px; margin-top: 20px; }
          p { margin: 6px 0; font-size: 14px; }
          .box { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin: 10px 0; background: #f9f9f9; }
          .highlight { font-weight: bold; font-size: 16px; color: #1a56db; }
        </style>
      </head>
      <body>
        <h1>הוראות שימוש בסים גלישה</h1>
        <div class="box">
          <p>לקוח: <strong>${customerName}</strong></p>
          <p>סים: <span class="highlight">${simLabel}</span></p>
          ${deviceName ? `<p>מכשיר: <strong>${deviceName}</strong></p>` : ''}
          <p>תקופת השכרה: ${startDate} — ${endDate} (${days} ימים)</p>
          <p>מחיר כולל: <strong>&#8362;${totalPrice}</strong></p>
        </div>
        <h2>הוראות הפעלה:</h2>
        <div class="box">
          <p>1. הכנס את הסים לטלפון</p>
          <p>2. הפעל את הטלפון וחכה להתחברות לרשת (עד 2 דקות)</p>
          <p>3. לשיחות לישראל: חייג <strong>00972</strong> + המספר</p>
          <p>4. המספר שלך: <strong>${sim?.uk_number || sim?.il_number || simLabel}</strong></p>
        </div>
        <p style="margin-top:20px; font-size:12px; color:#666;">ניתן ליצור קשר לכל שאלה. תודה שבחרתם בשירות שלנו!</p>
        <script>window.onload = function(){ window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSubmit = async () => {
    if (!sim) return;
    const customerName = selectedCustomer?.name || manualName.trim();
    if (!customerName) {
      setErrorMsg('יש לבחור לקוח או להזין שם');
      return;
    }
    if (totalPrice === 0 && !simDailyRate) {
      setErrorMsg('יש להזין מחיר');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      // Step 1: Activate on CellStation (abort rest if this fails)
      const activateResult = await onActivate(sim, {
        start_rental: startDate,
        end_rental: endDate,
        price: String(totalPrice),
        days: String(days),
        note: customerName,
      });
      if (activateResult?.success === false) {
        throw new Error(activateResult.error || 'שגיאה בהפעלת הסים');
      }

      // Step 2: Create rental record
      const { data: newRental, error: rentalError } = await supabase
        .from('rentals' as any)
        .insert({
          customer_id: selectedCustomer?.id || null,
          customer_name: customerName,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          total_price: totalPrice,
          currency: 'ILS',
        })
        .select('id')
        .single();
      if (rentalError) throw new Error(rentalError.message);

      const rentalId = (newRental as any).id;

      // Step 3: Get or create SIM inventory item
      const { data: invItem } = await supabase
        .from('inventory' as any)
        .select('id')
        .eq('sim_number', sim.iccid || '')
        .maybeSingle();

      let simInventoryId: string;
      if (invItem) {
        simInventoryId = (invItem as any).id;
      } else {
        const { data: newInv, error: invErr } = await supabase
          .from('inventory' as any)
          .insert({
            name: 'סים גלישה',
            category: 'sim_european',
            sim_number: sim.iccid || '',
            local_number: sim.uk_number || null,
            israeli_number: sim.il_number || null,
            expiry_date: sim.expiry_date || null,
            status: 'rented',
          })
          .select('id')
          .single();
        if (invErr) throw new Error(invErr.message);
        simInventoryId = (newInv as any).id;
      }

      // Step 4: Create rental_item for SIM
      const { error: simItemError } = await supabase
        .from('rental_items' as any)
        .insert({
          rental_id: rentalId,
          inventory_item_id: simInventoryId,
          item_name: sim.uk_number || sim.il_number || sim.iccid || 'SIM',
          item_category: 'sim_european',
        });
      if (simItemError) throw new Error(simItemError.message);

      // Update SIM status if pre-existing
      if (invItem) {
        await supabase
          .from('inventory' as any)
          .update({ status: 'rented' })
          .eq('id', simInventoryId);
      }

      // Step 5: If device selected, add rental_item + mark as rented
      if (selectedDevice) {
        await supabase
          .from('rental_items' as any)
          .insert({
            rental_id: rentalId,
            inventory_item_id: selectedDevice.id,
            item_name: selectedDevice.name,
            item_category: selectedDevice.category,
          });
        await supabase
          .from('inventory' as any)
          .update({ status: 'rented' })
          .eq('id', selectedDevice.id);
      }

      setCreatedRentalId(rentalId);
      setStep('success');
      onSuccess?.();
    } catch (e: any) {
      const msg = e.message || 'שגיאה ביצירת ההשכרה';
      setErrorMsg(msg);
      toast({ title: '❌ שגיאה', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setManualName('');
    setStartDate(today);
    setEndDate(defaultEnd);
    setSimDailyRate('');
    setDeviceDailyRate('');
    setSelectedDevice(null);
    setIsSubmitting(false);
    setStep('form');
    setCreatedRentalId(null);
    setErrorMsg('');
    setDropdownOpen(false);
    onClose();
  }, [onClose, today, defaultEnd]);

  if (!sim) return null;

  const simLabel =
    sim.uk_number || sim.il_number || sim.sim_number ||
    (sim.iccid ? '...' + sim.iccid.slice(-6) : '—');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">📋 השכרה מהירה</DialogTitle>
        </DialogHeader>

        {/* SIM info banner */}
        <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2 text-sm">
          <span className="font-mono font-semibold">{simLabel}</span>
          {sim.plan && <span className="text-muted-foreground mr-2">· {sim.plan}</span>}
        </div>

        {step === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <p className="font-bold text-lg text-green-700">ההשכרה נוצרה בהצלחה!</p>
              <p className="text-sm text-muted-foreground mt-1">הסים הופעל ונרשם בסיסטם</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> הדפס הוראות
              </Button>
              <Button variant="outline" onClick={handleClose}>סגור</Button>
              {createdRentalId && (
                <Button onClick={() => { navigate(`/rentals?highlight=${createdRentalId}`); handleClose(); }}>
                  עבור להשכרה →
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer search */}
            <div className="space-y-2">
              <Label>לקוח</Label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <User className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-medium flex-1">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && (
                    <span className="text-muted-foreground text-xs">{selectedCustomer.phone}</span>
                  )}
                  <button
                    onClick={() => { setSelectedCustomer(null); setSearchTerm(''); setManualName(''); }}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pr-9"
                    placeholder="חפש לפי שם או טלפון..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setManualName(e.target.value); }}
                    autoComplete="off"
                  />
                  {isSearching && (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {dropdownOpen && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map(c => (
                        <button
                          key={c.id}
                          className="w-full text-right px-3 py-2.5 hover:bg-muted/60 flex justify-between items-center text-sm border-b border-border/40 last:border-0"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setSearchTerm(c.name);
                            setManualName(c.name);
                            setDropdownOpen(false);
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground text-xs">{c.phone}</span>
                        </button>
                      ))}
                      <button
                        className="w-full text-right px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 border-t border-border/40"
                        onClick={() => { setSelectedCustomer(null); setManualName(searchTerm); setDropdownOpen(false); }}
                      >
                        המשך עם &quot;{searchTerm}&quot; ללא קישור ללקוח
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Device selection (optional) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> תוספת מכשיר (אופציונלי)
              </Label>
              {selectedDevice ? (
                <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                  <Smartphone className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="font-medium flex-1">{selectedDevice.name}</span>
                  <button
                    onClick={() => { setSelectedDevice(null); setDeviceDailyRate(''); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value=""
                  onChange={e => {
                    const device = devices.find(d => d.id === e.target.value);
                    if (device) setSelectedDevice(device);
                  }}
                >
                  <option value="">ללא מכשיר</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>תאריך התחלה</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>תאריך סיום</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-2">
              <Label>מחיר</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">מחיר סים ליום (₪)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={simDailyRate}
                    onChange={e => setSimDailyRate(e.target.value)}
                  />
                </div>
                {selectedDevice && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">מחיר מכשיר ליום (₪)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={deviceDailyRate}
                      onChange={e => setDeviceDailyRate(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {/* Auto-calculated total */}
              <div className="rounded-lg bg-muted/50 border p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>סים: ₪{simDailyRate || 0} × {days} ימים</span>
                  <span>₪{simTotal}</span>
                </div>
                {selectedDevice && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>מכשיר: ₪{deviceDailyRate || 0} × {days} ימים</span>
                    <span>₪{deviceTotal}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-foreground border-t pt-1 mt-1">
                  <span>סה&quot;כ לתשלום</span>
                  <span>₪{totalPrice}</span>
                </div>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                ביטול
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !startDate || !endDate}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> יוצר...</>
                ) : (
                  '✅ צור השכרה'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

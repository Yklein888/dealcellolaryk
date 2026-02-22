import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

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
}

interface QuickActivateDialogProps {
  sim: SimRow;
  isOpen: boolean;
  onClose: () => void;
  onActivate: (sim: SimRow, params: {
    start_rental: string;
    end_rental: string;
    price: string;
    days: string;
    note: string;
  }) => Promise<any>;
  isActivating: boolean;
}

export function QuickActivateDialog({ sim, isOpen, onClose, onActivate, isActivating }: QuickActivateDialogProps) {
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));

  const handleActivate = async () => {
    if (!startDate || !endDate) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await onActivate(sim, {
        start_rental: startDate,
        end_rental: endDate,
        price,
        days: String(days),
        note,
      });
      if (result?.success === false) {
        setStatus('error');
        setErrorMsg(result.error || 'שגיאה בהפעלה');
      } else {
        setStatus('success');
        setTimeout(() => {
          onClose();
          setStatus('idle');
        }, 1500);
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message || 'שגיאה בהפעלה');
    }
  };

  const simLabel = sim.il_number || sim.uk_number || sim.sim_number || sim.iccid;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            הפעלת סים
          </DialogTitle>
          <DialogDescription>
            סים: <span className="font-mono font-bold">{simLabel}</span>
            {sim.plan && <span className="mr-2 text-muted-foreground">· {sim.plan}</span>}
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-green-700 font-semibold text-lg">הסים הופעל בהצלחה!</p>
            <p className="text-sm text-muted-foreground">הסים עבר למושכרים</p>
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>מחיר (₪)</Label>
                <Input type="number" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>ימים</Label>
                <Input value={days} readOnly className="bg-muted" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>הערה</Label>
              <Input placeholder="הערה אופציונלית..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} disabled={status === 'loading'}>ביטול</Button>
              <Button
                onClick={handleActivate}
                disabled={status === 'loading' || isActivating || !startDate || !endDate}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {status === 'loading' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> מפעיל...</>
                ) : (
                  <><Zap className="h-4 w-4" /> הפעל סים</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

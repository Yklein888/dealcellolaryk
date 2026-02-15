import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowLeftRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CellStationSim {
  id: string;
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status: string | null;
  status_detail: string | null;
  plan: string | null;
  customer_name: string | null;
}

interface SwapSimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSim: CellStationSim;
  availableSims: CellStationSim[];
  onSwap: (params: {
    rental_id: string;
    current_sim: string;
    swap_msisdn: string;
    swap_iccid: string;
  }) => Promise<any>;
  isSwapping: boolean;
  rentalId?: string;
}

export function SwapSimDialog({
  open,
  onOpenChange,
  currentSim,
  availableSims,
  onSwap,
  isSwapping,
  rentalId,
}: SwapSimDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedSimId, setSelectedSimId] = useState('');
  const [manualIccid, setManualIccid] = useState('');
  const [useManual, setUseManual] = useState(false);

  const filtered = useMemo(() => {
    const avail = availableSims.filter(s => s.status === 'available' && s.status_detail === 'valid');
    if (!search.trim()) return avail;
    const q = search.toLowerCase();
    return avail.filter(s =>
      [s.sim_number, s.uk_number, s.il_number, s.iccid].some(v => v?.toLowerCase().includes(q))
    );
  }, [availableSims, search]);

  const selectedSim = availableSims.find(s => s.id === selectedSimId);

  // Determine which ICCID to use
  const effectiveIccid = useManual ? manualIccid : (selectedSim?.iccid || '');
  const isIccidValid = effectiveIccid.length >= 19 && effectiveIccid.length <= 20 && /^\d+$/.test(effectiveIccid);

  const handleSwap = async () => {
    if (!isIccidValid) return;

    await onSwap({
      rental_id: rentalId || '',
      current_sim: currentSim.sim_number || '',
      swap_msisdn: useManual ? '' : (selectedSim?.uk_number || ''),
      swap_iccid: effectiveIccid,
    });

    onOpenChange(false);
    setSelectedSimId('');
    setManualIccid('');
    setUseManual(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            החלפת סים
          </DialogTitle>
          <DialogDescription>
            החלף את הסים הנוכחי בסים חדש
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current SIM Info */}
          <div className="p-3 rounded-md bg-muted/50 border">
            <Label className="text-xs text-muted-foreground">סים נוכחי</Label>
            <div className="flex items-center justify-between mt-1">
              <Badge variant="outline">{currentSim.plan || 'ללא חבילה'}</Badge>
              <div className="text-sm">
                <span className="font-mono">{currentSim.uk_number || currentSim.il_number || '---'}</span>
                <span className="text-xs text-muted-foreground mr-2">
                  ...{currentSim.iccid?.slice(-6)}
                </span>
              </div>
            </div>
            {currentSim.customer_name && (
              <p className="text-xs text-muted-foreground mt-1">לקוח: {currentSim.customer_name}</p>
            )}
          </div>

          {/* New SIM Selection - Dropdown */}
          <div className="space-y-2">
            <Label>בחר סים חדש מהרשימה</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש סים..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-10"
                onFocus={() => setUseManual(false)}
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filtered.map(sim => (
                <button
                  key={sim.id}
                  onClick={() => {
                    setSelectedSimId(sim.id);
                    setUseManual(false);
                    setManualIccid('');
                  }}
                  className={cn(
                    'w-full text-right p-2 rounded-md text-sm border transition-colors',
                    selectedSimId === sim.id && !useManual
                      ? 'bg-primary/10 border-primary ring-1 ring-primary'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <span className="font-mono text-xs">{sim.uk_number || sim.il_number || '---'}</span>
                  <span className="text-[10px] mr-2 text-muted-foreground">...{sim.iccid?.slice(-6)}</span>
                </button>
              ))}
            </div>
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
              value={manualIccid}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setManualIccid(val);
                if (val) {
                  setUseManual(true);
                  setSelectedSimId('');
                }
              }}
              placeholder="89..."
              dir="ltr"
              className={cn(
                "font-mono",
                useManual && manualIccid ? 'ring-1 ring-primary border-primary' : ''
              )}
              maxLength={20}
            />
            {manualIccid && !isIccidValid && useManual && (
              <p className="text-xs text-destructive">ICCID חייב להיות 19-20 ספרות</p>
            )}
          </div>

          <Button
            onClick={handleSwap}
            disabled={isSwapping || !isIccidValid}
            className="w-full gap-2"
          >
            {isSwapping ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> מחליף...</>
            ) : (
              <><ArrowLeftRight className="h-4 w-4" /> החלף סים</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

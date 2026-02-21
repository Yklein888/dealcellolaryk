import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeftRight, Zap, AlertTriangle, User, Calendar, Smartphone, Globe } from 'lucide-react';
import { printCallingInstructions } from '@/lib/callingInstructions';
import { useToast } from '@/hooks/use-toast';

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

type SystemStatus = 'match' | 'needs_swap' | 'not_in_inventory' | 'both_rented';

interface InventoryMap {
  [iccid: string]: { status: string; id: string };
}

interface SimCardGridProps {
  sims: SimRow[];
  showCustomer?: boolean;
  showSwap?: boolean;
  showSystemStatus?: boolean;
  inventoryMap?: InventoryMap;
  onSwapClick?: (sim: SimRow) => void;
  onActivateAndSwapClick?: (sim: SimRow) => void;
  needsSwapIccids?: Set<string>;
  onRentalClick?: (sim: SimRow) => void;
}

function getSystemStatus(sim: SimRow, inventoryMap: InventoryMap): SystemStatus {
  if (!sim.iccid || !inventoryMap[sim.iccid]) return 'not_in_inventory';
  const inv = inventoryMap[sim.iccid];
  if (sim.status === 'available' && inv.status === 'rented') return 'needs_swap';
  if (sim.status === 'rented' && inv.status === 'rented') return 'both_rented';
  return 'match';
}

function getCardColor(sim: SimRow): { border: string; bg: string; accent: string } {
  if (sim.status === 'rented') {
    return { border: 'border-blue-300 dark:border-blue-700', bg: 'bg-blue-50/80 dark:bg-blue-950/30', accent: 'text-blue-700 dark:text-blue-300' };
  }
  switch (sim.status_detail) {
    case 'expired':
      return { border: 'border-red-300 dark:border-red-700', bg: 'bg-red-50/80 dark:bg-red-950/30', accent: 'text-red-700 dark:text-red-300' };
    case 'expiring':
      return { border: 'border-yellow-300 dark:border-yellow-700', bg: 'bg-yellow-50/80 dark:bg-yellow-950/30', accent: 'text-yellow-700 dark:text-yellow-300' };
    case 'valid':
      return { border: 'border-green-300 dark:border-green-700', bg: 'bg-green-50/80 dark:bg-green-950/30', accent: 'text-green-700 dark:text-green-300' };
    default:
      return { border: 'border-border', bg: 'bg-card', accent: 'text-muted-foreground' };
  }
}

function getPortalStatusLabel(sim: SimRow): { label: string; emoji: string } {
  if (sim.status === 'rented') return { label: 'מושכר', emoji: '🔄' };
  switch (sim.status_detail) {
    case 'valid': return { label: 'תקין', emoji: '✅' };
    case 'expiring': return { label: 'קרוב לפקיעה', emoji: '⚠️' };
    case 'expired': return { label: 'פג תוקף', emoji: '❌' };
    default: return { label: 'לא ידוע', emoji: '❓' };
  }
}

function getSystemStatusLabel(status: SystemStatus): { label: string; emoji: string; className: string } {
  switch (status) {
    case 'match': return { label: 'תואם', emoji: '✅', className: 'text-green-600 dark:text-green-400' };
    case 'needs_swap': return { label: 'צריך החלפה', emoji: '⚠️', className: 'text-orange-600 dark:text-orange-400' };
    case 'not_in_inventory': return { label: 'לא במלאי', emoji: '❌', className: 'text-muted-foreground' };
    case 'both_rented': return { label: 'מושכר', emoji: '🔄', className: 'text-blue-600 dark:text-blue-400' };
  }
}

function formatDate(d: string | null) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('he-IL');
  } catch { return d; }
}

function shortIccid(iccid: string | null) {
  if (!iccid) return '-';
  return '...' + iccid.slice(-6);
}

// Smart sorting: needs_swap first, then expired, expiring, rented, valid
function sortPriority(sim: SimRow, needsSwapIccids?: Set<string>): number {
  if (needsSwapIccids?.has(sim.iccid || '')) return 0;
  if (sim.status_detail === 'expired') return 1;
  if (sim.status_detail === 'expiring') return 2;
  if (sim.status === 'rented') return 3;
  return 4;
}

export function SimCardGrid({
  sims,
  showCustomer,
  showSwap,
  showSystemStatus,
  inventoryMap,
  onSwapClick,
  onActivateAndSwapClick,
  needsSwapIccids,
  onRentalClick,
}: SimCardGridProps) {
  const { toast } = useToast();
  const [printingId, setPrintingId] = useState<string | null>(null);

  if (sims.length === 0) {
    return <p className="text-center text-muted-foreground py-8">אין סימים להצגה</p>;
  }

  const sorted = [...sims].sort((a, b) => sortPriority(a, needsSwapIccids) - sortPriority(b, needsSwapIccids));

  const handlePrint = async (sim: SimRow) => {
    if (!sim.uk_number && !sim.il_number) return;
    setPrintingId(sim.id);
    try {
      await printCallingInstructions(
        sim.il_number || undefined,
        sim.uk_number || undefined,
        undefined, // barcode
        false, // isAmericanSim
        sim.plan || undefined,
        sim.expiry_date ? formatDate(sim.expiry_date) : undefined,
        sim.iccid || undefined,
      );
      toast({ title: 'הוראות חיוג נשלחו להדפסה' });
    } catch (e: any) {
      toast({ title: 'שגיאה בהדפסה', description: e.message, variant: 'destructive' });
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
      {sorted.map((sim) => {
        const colors = getCardColor(sim);
        const portalStatus = getPortalStatusLabel(sim);
        const sysStatus = showSystemStatus && inventoryMap ? getSystemStatus(sim, inventoryMap) : null;
        const sysLabel = sysStatus ? getSystemStatusLabel(sysStatus) : null;
        const needsSwap = needsSwapIccids?.has(sim.iccid || '');
        const canPrint = !!(sim.uk_number || sim.il_number);

        return (
          <div
            key={sim.id}
            className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 transition-all duration-200 hover:shadow-md relative flex flex-col gap-3`}
          >
            {/* Header: Plan badge + Print button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sim.plan && (
                  <Badge variant="secondary" className="text-xs">
                    {sim.plan}
                  </Badge>
                )}
                {needsSwap && (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
              </div>
              {canPrint && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => handlePrint(sim)}
                  disabled={printingId === sim.id}
                  title="הדפס הוראות חיוג"
                >
                  <Printer className={`h-4 w-4 ${printingId === sim.id ? 'animate-pulse' : ''}`} />
                </Button>
              )}
            </div>

            {/* Phone Numbers */}
            <div className="space-y-1">
              {sim.il_number && (
                <div className="flex items-center gap-2 text-sm" dir="ltr">
                  <span className="text-base">🇮🇱</span>
                  <span className="font-mono font-bold text-foreground">{sim.il_number}</span>
                </div>
              )}
              {sim.uk_number && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" dir="ltr">
                  <span className="text-base">🇬🇧</span>
                  <span className="font-mono">{sim.uk_number}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground font-mono">
                ICCID: {shortIccid(sim.iccid)}
              </div>
            </div>

            {/* Expiry Date */}
            {sim.expiry_date && (
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={colors.accent}>
                  {formatDate(sim.expiry_date)}
                </span>
              </div>
            )}

            {/* Dual Status Indicators */}
            <div className="flex items-center gap-3 flex-wrap text-xs border-t pt-2 border-border/50">
              <div className="flex items-center gap-1">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">פורטל:</span>
                <span className={colors.accent}>{portalStatus.emoji} {portalStatus.label}</span>
              </div>
              {sysLabel && (
                <div className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">מערכת:</span>
                  <span className={sysLabel.className}>{sysLabel.emoji} {sysLabel.label}</span>
                </div>
              )}
            </div>

            {/* Customer name (if rented) */}
            {showCustomer && sim.customer_name && (
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{sim.customer_name}</span>
              </div>
            )}

            {/* Rental period */}
            {showCustomer && sim.start_date && (
              <div className="text-xs text-muted-foreground">
                {formatDate(sim.start_date)} - {formatDate(sim.end_date)}
              </div>
            )}

            {/* Action buttons */}
            {(showSwap || needsSwap || onRentalClick) && (
              <div className="flex gap-2 mt-auto pt-1">
                {onRentalClick && sim.status === 'rented' && (
                  <Button size="sm" variant="outline" onClick={() => onRentalClick(sim)} className="gap-1 text-xs flex-1">
                    🔗 השכרה
                  </Button>
                )}
                {showSwap && onSwapClick && (
                  <Button size="sm" variant="outline" onClick={() => onSwapClick(sim)} className="gap-1 text-xs flex-1">
                    <ArrowLeftRight className="h-3 w-3" /> החלף
                  </Button>
                )}
                {needsSwap && onActivateAndSwapClick && (
                  <Button size="sm" variant="default" onClick={() => onActivateAndSwapClick(sim)} className="gap-1 text-xs flex-1">
                    <Zap className="h-3 w-3" /> הפעל+החלף
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

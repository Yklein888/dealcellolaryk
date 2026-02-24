import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Package, ArrowLeftRight } from 'lucide-react';

export type SimActionType = 'quick_rental' | 'activate_and_swap';

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

interface SimActionDialogProps {
  sim: SimRow | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: SimActionType) => void;
}

interface ActionItem {
  key: SimActionType;
  title: string;
  description: string;
  border: string;
  iconBg: string;
  iconColor: string;
}

const ACTION_LIST: ActionItem[] = [
  {
    key: 'quick_rental',
    title: 'השכרה מהירה',
    description: 'הפעל + צור השכרה בסיסטם ללקוח',
    border: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/60',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    key: 'activate_and_swap',
    title: 'הפעלה והחלפה',
    description: 'הפעל סים חדש והחלף ישן קיים',
    border: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50/60',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
];

function ActionIcon({ actionKey, className }: { actionKey: SimActionType; className?: string }) {
  if (actionKey === 'quick_rental') return <Package className={className} />;
  return <ArrowLeftRight className={className} />;
}

export function SimActionDialog({ sim, isOpen, onClose, onAction }: SimActionDialogProps) {
  if (!sim) return null;

  const simLabel =
    sim.uk_number || sim.il_number || sim.sim_number ||
    (sim.iccid ? '...' + sim.iccid.slice(-6) : '—');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">בחר פעולה לסים</DialogTitle>
          <DialogDescription asChild>
            <div className="rounded-lg bg-muted/60 border border-border/50 px-3 py-2 text-sm mt-1">
              <span className="font-mono font-semibold text-foreground">{simLabel}</span>
              {sim.plan && <span className="text-muted-foreground mr-2">· {sim.plan}</span>}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 mt-1">
          {ACTION_LIST.map((action) => (
            <button
              key={action.key}
              onClick={() => onAction(action.key)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-right transition-all duration-150 cursor-pointer active:scale-[0.98] ${action.border}`}
            >
              <div className={`rounded-xl p-2.5 shrink-0 ${action.iconBg}`}>
                <ActionIcon actionKey={action.key} className={`h-6 w-6 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-base leading-snug">{action.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

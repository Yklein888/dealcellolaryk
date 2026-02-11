import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { InventoryItem } from '@/types/rental';
import { format, parseISO } from 'date-fns';

interface ExpiryWarningDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onConfirm: () => void;
}

export function ExpiryWarningDialog({ isOpen, onOpenChange, item, onConfirm }: ExpiryWarningDialogProps) {
  if (!item) return null;

  const expiryFormatted = item.expiryDate ? format(parseISO(item.expiryDate), 'dd/MM/yyyy') : 'לא ידוע';

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            ⚠️ סים פג תוקף
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-base">
                הסים <strong>{item.name}</strong> פג תוקף בתאריך: <strong>{expiryFormatted}</strong>
              </p>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  💡 לפני ההפעלה באתר CellStation, יש להאריך את התוקף של הסים.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                האם להמשיך בכל זאת?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            כן, המשך בכל זאת
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

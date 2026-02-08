import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePendingActivations } from '@/hooks/usePendingActivations';
import { useState } from 'react';

const CELLSTATION_URL = 'https://cellstation.co.uk';

export function PendingActivationsAlert() {
  const { pendingCount, isLoading } = usePendingActivations();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isLoading || pendingCount === 0 || isDismissed) {
    return null;
  }

  return (
    <Alert className="mb-6 border-warning/50 bg-warning/10">
      <AlertTriangle className="h-5 w-5 text-warning" />
      <AlertTitle className="text-warning font-bold">
        יש {pendingCount} סימים ממתינים להפעלה
      </AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
        <span className="text-muted-foreground">
          לחץ על ה-Bookmarklet באתר CellStation להשלמת ההפעלה
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(CELLSTATION_URL, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            פתח CellStation
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

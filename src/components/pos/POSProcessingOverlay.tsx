import { ProcessingSaleState } from '@/types/pos';
import { Loader2, CreditCard, FileText, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface POSProcessingOverlayProps {
  state: ProcessingSaleState;
}

const steps = [
  { key: 'creating', label: 'יוצר עסקה', icon: FileText },
  { key: 'processing_payment', label: 'מעבד תשלום', icon: CreditCard },
  { key: 'generating_document', label: 'יוצר מסמך', icon: FileText },
];

export function POSProcessingOverlay({ state }: POSProcessingOverlayProps) {
  if (state.step === 'idle' || state.step === 'completed' || state.step === 'failed') {
    return null;
  }

  const currentStepIndex = steps.findIndex(s => s.key === state.step);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center space-y-8 p-8">
        <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
        
        <div>
          <h2 className="text-2xl font-bold mb-2">מעבד עסקה</h2>
          <p className="text-muted-foreground">אנא המתן...</p>
        </div>

        <div className="flex flex-col gap-4 max-w-xs mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <div
                key={step.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  isActive && "bg-primary/10",
                  isCompleted && "bg-green-100 dark:bg-green-900/20"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-full",
                  isActive && "bg-primary text-primary-foreground",
                  isCompleted && "bg-green-500 text-white",
                  !isActive && !isCompleted && "bg-muted"
                )}>
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span className={cn(
                  "font-medium",
                  isActive && "text-primary",
                  isCompleted && "text-green-600 dark:text-green-400"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

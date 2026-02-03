import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSimActivation, ActivationStatus } from '@/hooks/useSimActivation';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SimActivationButtonProps {
  simNumber: string;
  rentalId?: string;
  customerId?: string;
  compact?: boolean;
  onStatusChange?: (status: ActivationStatus) => void;
}

export function SimActivationButton({
  simNumber,
  rentalId,
  customerId,
  compact = false,
  onStatusChange,
}: SimActivationButtonProps) {
  const { requestActivation, isActivating } = useSimActivation();
  const [status, setStatus] = useState<ActivationStatus>('none');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current activation status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('sim_cards')
          .select('activation_status')
          .eq('sim_number', simNumber)
          .single();

        if (data?.activation_status) {
          setStatus(data.activation_status as ActivationStatus);
        }
      } catch {
        // SIM not found, default to 'none'
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`sim-activation-${simNumber}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sim_cards',
          filter: `sim_number=eq.${simNumber}`,
        },
        (payload) => {
          const newStatus = payload.new.activation_status as ActivationStatus;
          setStatus(newStatus);
          onStatusChange?.(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [simNumber, onStatusChange]);

  const handleActivate = async () => {
    const success = await requestActivation(simNumber, rentalId, customerId);
    if (success) {
      setStatus('pending');
      onStatusChange?.('pending');
    }
  };

  const loading = isLoading || isActivating(simNumber);

  // Status indicator
  if (status === 'activated') {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 text-success",
        compact ? "text-xs" : "text-sm"
      )}>
        <CheckCircle className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>הופעל</span>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 text-warning animate-pulse",
        compact ? "text-xs" : "text-sm"
      )}>
        <Clock className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>ממתין להפעלה</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <div className={cn(
          "inline-flex items-center gap-1.5 text-destructive",
          compact ? "text-xs" : "text-sm"
        )}>
          <XCircle className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          <span>נכשל</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleActivate}
          disabled={loading}
          className="h-7 text-xs"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'נסה שוב'}
        </Button>
      </div>
    );
  }

  // Default: not activated yet
  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      onClick={handleActivate}
      disabled={loading}
      className={cn(
        "gap-1.5",
        compact && "h-7 text-xs px-2"
      )}
    >
      {loading ? (
        <Loader2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
      ) : (
        <Wifi className={compact ? "h-3 w-3" : "h-4 w-4"} />
      )}
      {loading ? 'שולח...' : 'הפעל סים'}
    </Button>
  );
}

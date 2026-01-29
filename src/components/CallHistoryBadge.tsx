import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Phone, CheckCircle, XCircle, Clock, PhoneIncoming, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface CallLog {
  id: string;
  entity_type: string;
  entity_id: string;
  customer_phone: string;
  call_status: 'pending' | 'answered' | 'no_answer' | 'busy' | 'callback';
  call_type: 'manual' | 'automatic';
  call_message?: string;
  created_at: string;
  updated_at?: string;
}

interface CallHistoryBadgeProps {
  entityType: 'rental' | 'repair';
  entityId: string;
  className?: string;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted', label: 'ממתין' },
  answered: { icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/20', label: 'ענה' },
  no_answer: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/20', label: 'לא ענה' },
  busy: { icon: Phone, color: 'text-warning', bgColor: 'bg-warning/20', label: 'תפוס' },
  callback: { icon: PhoneIncoming, color: 'text-primary', bgColor: 'bg-primary/20', label: 'התקשר חזרה' },
};

const callTypeLabels = {
  manual: 'ידני',
  automatic: 'אוטומטי',
};

export function CallHistoryBadge({ entityType, entityId, className }: CallHistoryBadgeProps) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchCallLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching call logs:', error);
        return;
      }

      setCallLogs((data || []) as CallLog[]);
    } catch (err) {
      console.error('Error fetching call logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallLogs();
  }, [entityType, entityId]);

  // Refresh when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchCallLogs();
    }
  }, [isOpen]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (callLogs.length === 0) {
    return null; // Don't show badge if no calls
  }

  // Determine badge color based on last call status
  const lastCall = callLogs[0];
  const lastStatus = statusConfig[lastCall.call_status] || statusConfig.pending;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 px-2 gap-1 ${className}`}
        >
          <Phone className={`h-3.5 w-3.5 ${lastStatus.color}`} />
          <span className="text-xs font-medium">{callLogs.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="start"
        dir="rtl"
      >
        <div className="p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="font-medium">היסטוריית שיחות ({callLogs.length})</span>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {callLogs.map((log) => {
            const status = statusConfig[log.call_status] || statusConfig.pending;
            const StatusIcon = status.icon;
            
            return (
              <div 
                key={log.id} 
                className="p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-full ${status.bgColor}`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} />
                    </div>
                    <span className={`text-sm font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {callTypeLabels[log.call_type]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(log.created_at), 'dd/MM/yy HH:mm', { locale: he })}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {log.customer_phone}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

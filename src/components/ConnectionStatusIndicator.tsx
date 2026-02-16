import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ConnectionStatusIndicator() {
  const { status, isOnline } = useConnectionStatus();

  const isConnected = status === 'connected' && isOnline;
  const isConnecting = status === 'connecting';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
          isConnected 
            ? 'text-green-700 dark:text-green-400' 
            : isConnecting 
              ? 'text-yellow-700 dark:text-yellow-400'
              : 'text-destructive bg-destructive/10'
        )}>
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Wifi className="h-3.5 w-3.5 hidden sm:block" />
            </>
          ) : isConnecting ? (
            <>
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <Wifi className="h-3.5 w-3.5 hidden sm:block" />
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <WifiOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">לא מחובר</span>
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isConnected ? 'מחובר · סנכרון חי פעיל' : isConnecting ? 'מתחבר...' : 'לא מחובר · עובד עם מטמון מקומי'}
      </TooltipContent>
    </Tooltip>
  );
}

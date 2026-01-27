import { useSessionTimeout } from '@/hooks/useSessionTimeout';

/**
 * SessionManager component - handles automatic session timeout for security.
 * Logs out users after 30 minutes of inactivity.
 * Shows a warning 5 minutes before timeout.
 */
export function SessionManager() {
  // Initialize session timeout hook
  useSessionTimeout();
  
  // This component doesn't render anything - it just manages the session
  return null;
}

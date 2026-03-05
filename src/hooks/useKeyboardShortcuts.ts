import { useEffect } from 'react';

export interface KeyboardShortcut {
  keys: string[]; // e.g., ['Control', 'k'] or ['Meta', 'k']
  description: string;
  action: () => void;
  enabled?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 * Supports Cmd/Ctrl+K, Cmd/Ctrl+N, etc.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        // Allow Escape to close modals even from inputs
        if (event.key === 'Escape') {
          target.blur();
        }
        return;
      }

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const requiredKeys = shortcut.keys.map(k => k.toLowerCase());
        const pressedKeys = [
          event.ctrlKey || event.metaKey ? 'control' : null,
          event.shiftKey ? 'shift' : null,
          event.altKey ? 'alt' : null,
          event.key.toLowerCase(),
        ].filter(Boolean) as string[];

        // Check if all required keys are pressed
        const isMatched =
          requiredKeys.length === pressedKeys.length &&
          requiredKeys.every(k =>
            pressedKeys.some(pk =>
              (k === 'control' && (pk === 'control')) ||
              (k === 'shift' && pk === 'shift') ||
              (k === 'alt' && pk === 'alt') ||
              pk === k
            )
          );

        if (isMatched) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Common shortcuts
 */
export const COMMON_SHORTCUTS = {
  search: { keys: ['Control', 'k'], description: 'חיפוש גלובלי' },
  newRental: { keys: ['Control', 'n'], description: 'השכרה חדשה' },
  newCustomer: { keys: ['Control', 'shift', 'n'], description: 'לקוח חדש' },
  help: { keys: ['?'], description: 'עזרה' },
  escape: { keys: ['Escape'], description: 'סגור' },
};

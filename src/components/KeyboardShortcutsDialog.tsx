import { memo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Shortcut {
  keys: string[];
  description: string;
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}

/**
 * Dialog showing all available keyboard shortcuts
 */
export const KeyboardShortcutsDialog = memo(function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredShortcuts = shortcuts.filter(shortcut =>
    shortcut.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedShortcuts = {
    navigation: filteredShortcuts.filter(s => ['חיפוש', 'עזרה'].includes(s.description)),
    actions: filteredShortcuts.filter(s => ['השכרה חדשה', 'לקוח חדש'].includes(s.description)),
    general: filteredShortcuts.filter(s => !['חיפוש', 'עזרה', 'השכרה חדשה', 'לקוח חדש'].includes(s.description)),
  };

  const renderShortcutKey = (keys: string[]) => (
    <div className="flex gap-1">
      {keys.map((key, index) => (
        <span key={index}>
          <kbd className={cn(
            'px-2 py-1 rounded bg-muted border border-border text-xs font-semibold',
            'text-foreground'
          )}>
            {key === 'Control' ? 'Ctrl' : key === 'Meta' ? 'Cmd' : key}
          </kbd>
          {index < keys.length - 1 && <span className="mx-1">+</span>}
        </span>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>קיצורי מקלדת</DialogTitle>
          <DialogDescription>
            השתמש בקיצורים אלה כדי לנווט מהר יותר
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="חפש קיצור..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-6 max-h-[400px] overflow-y-auto">
          {groupedShortcuts.navigation.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">ניווט</h3>
              <div className="space-y-2">
                {groupedShortcuts.navigation.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    {renderShortcutKey(shortcut.keys)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedShortcuts.actions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">פעולות</h3>
              <div className="space-y-2">
                {groupedShortcuts.actions.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    {renderShortcutKey(shortcut.keys)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupedShortcuts.general.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">כללי</h3>
              <div className="space-y-2">
                {groupedShortcuts.general.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    {renderShortcutKey(shortcut.keys)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredShortcuts.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">לא נמצאו קיצורים</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

KeyboardShortcutsDialog.displayName = 'KeyboardShortcutsDialog';

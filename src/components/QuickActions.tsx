import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  UserPlus,
  Package,
  ShoppingCart,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'rental',
    label: 'השכרה חדשה',
    description: 'צור השכרה ללקוח קיים או חדש',
    icon: <ShoppingCart className="h-6 w-6" />,
    color: 'bg-primary/20 text-primary hover:bg-primary/30',
    path: '/rentals',
  },
  {
    id: 'customer',
    label: 'לקוח חדש',
    description: 'הוסף לקוח חדש למערכת',
    icon: <UserPlus className="h-6 w-6" />,
    color: 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30',
    path: '/customers',
  },
  {
    id: 'repair',
    label: 'תיקון חדש',
    description: 'פתח תיקון חדש במעבדה',
    icon: <Wrench className="h-6 w-6" />,
    color: 'bg-orange-500/20 text-orange-600 hover:bg-orange-500/30',
    path: '/repairs',
  },
  {
    id: 'inventory',
    label: 'פריט חדש במלאי',
    description: 'הוסף פריט חדש למלאי',
    icon: <Package className="h-6 w-6" />,
    color: 'bg-green-500/20 text-green-600 hover:bg-green-500/30',
    path: '/inventory',
  },
];

interface QuickActionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickActions({ isOpen, onClose }: QuickActionsProps) {
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    navigate(action.path);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            פעולות מהירות
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 mt-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-200 ${action.color}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/50">
                {action.icon}
              </div>
              <div className="flex-1 text-right">
                <p className="font-semibold">{action.label}</p>
                <p className="text-sm opacity-80">{action.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 opacity-50" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

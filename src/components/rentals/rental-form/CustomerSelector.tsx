import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, User, Phone, UserPlus, Check } from 'lucide-react';
import { Customer } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CustomerSelectorProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  onAddCustomer: (customer: { name: string; phone: string; address?: string }) => Promise<void>;
}

export function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onAddCustomer,
}: CustomerSelectorProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickData, setQuickData] = useState({ name: '', phone: '', address: '' });

  const filtered = customers.filter(c => {
    const q = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(searchTerm);
  });

  const handleQuickAdd = async () => {
    if (!quickData.name || !quickData.phone) {
      toast({ title: 'שגיאה', description: 'יש להזין שם וטלפון', variant: 'destructive' });
      return;
    }
    try {
      await onAddCustomer({
        name: quickData.name,
        phone: quickData.phone,
        address: quickData.address || undefined,
      });
      toast({ title: 'לקוח נוסף', description: `${quickData.name} נוסף בהצלחה` });
      setQuickData({ name: '', phone: '', address: '' });
      setIsQuickAddOpen(false);
    } catch {
      toast({ title: 'שגיאה', description: 'לא ניתן להוסיף לקוח', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="space-y-3 p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm sm:text-base font-semibold">
            <User className="h-5 w-5 text-primary" />
            בחר לקוח
          </Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsQuickAddOpen(true)} className="h-8 text-xs gap-1">
            <UserPlus className="h-4 w-4" />
            הוסף לקוח
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="חפש לפי שם או טלפון..." className="pr-10" />
        </div>

        <div className="max-h-48 sm:max-h-60 overflow-y-auto border rounded-lg bg-background">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              {customers.length === 0 ? 'אין לקוחות במערכת' : 'לא נמצאו לקוחות'}
            </p>
          ) : (
            filtered.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => onSelectCustomer(customer.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 hover:bg-muted/50 text-right transition-all border-b last:border-b-0",
                  selectedCustomerId === customer.id && "bg-primary/10 border-primary/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{customer.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {customer.phone}
                    </p>
                  </div>
                </div>
                {selectedCustomerId === customer.id && <Check className="h-5 w-5 text-primary" />}
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוספת לקוח חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>שם *</Label>
              <Input value={quickData.name} onChange={(e) => setQuickData({ ...quickData, name: e.target.value })} placeholder="שם הלקוח" />
            </div>
            <div className="space-y-2">
              <Label>טלפון *</Label>
              <Input value={quickData.phone} onChange={(e) => setQuickData({ ...quickData, phone: e.target.value })} placeholder="050-0000000" />
            </div>
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input value={quickData.address} onChange={(e) => setQuickData({ ...quickData, address: e.target.value })} placeholder="כתובת (אופציונלי)" />
            </div>
            <Button onClick={handleQuickAdd} className="w-full">הוסף לקוח</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

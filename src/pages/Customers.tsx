import { useState } from 'react';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  Users,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Customer } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    creditCard: '',
    notes: '',
  });

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      email: '',
      creditCard: '',
      notes: '',
    });
    setEditingCustomer(null);
  };

  const handleSubmit = () => {
    if (!formData.name && !formData.phone) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין לפחות שם או טלפון',
        variant: 'destructive',
      });
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
      toast({
        title: 'לקוח עודכן',
        description: 'פרטי הלקוח עודכנו בהצלחה',
      });
    } else {
      addCustomer(formData);
      toast({
        title: 'לקוח נוסף',
        description: 'הלקוח נוסף למערכת בהצלחה',
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      email: customer.email || '',
      creditCard: customer.creditCard || '',
      notes: customer.notes || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCustomer(id);
    toast({
      title: 'לקוח נמחק',
      description: 'הלקוח הוסר מהמערכת',
    });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="ניהול לקוחות" 
        description="הוספה, עריכה ומעקב אחר לקוחות"
      >
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="glow" size="lg">
              <Plus className="h-5 w-5" />
              הוסף לקוח
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? 'עריכת לקוח' : 'הוספת לקוח חדש'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>שם</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="שם מלא"
                />
              </div>

              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="050-1234567"
                />
              </div>

              <div className="space-y-2">
                <Label>כתובת</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="כתובת מגורים"
                />
              </div>

              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>כרטיס אשראי (לפיקדון)</Label>
                <Input
                  value={formData.creditCard}
                  onChange={(e) => setFormData({ ...formData, creditCard: e.target.value })}
                  placeholder="4 ספרות אחרונות"
                />
              </div>

              <div className="space-y-2">
                <Label>הערות</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  {editingCustomer ? 'עדכן' : 'הוסף'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-4 sm:mb-6">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="חיפוש לפי שם, טלפון או אימייל..."
          className="pr-10"
        />
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="stat-card text-center py-8 sm:py-12">
          <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
          <p className="text-base sm:text-lg font-medium text-foreground">אין לקוחות</p>
          <p className="text-sm text-muted-foreground">הוסף לקוחות חדשים כדי להתחיל</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredCustomers.map((customer) => (
            <div 
              key={customer.id}
              className="stat-card hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-base sm:text-lg">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-base sm:text-lg truncate">{customer.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      לקוח מ-{format(parseISO(customer.createdAt), 'MM/yyyy', { locale: he })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 sm:pt-3 border-t border-border">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEdit(customer)}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" />
                  עריכה
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive flex-1"
                  onClick={() => handleDelete(customer.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  מחיקה
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

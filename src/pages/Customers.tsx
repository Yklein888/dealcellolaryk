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
  MapPin,
  CreditCard,
  Loader2
} from 'lucide-react';
import { Customer } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, refreshData } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    notes: '',
    creditCard: '',
    creditCardExpiry: '',
    cvv: '',
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
      notes: '',
      creditCard: '',
      creditCardExpiry: '',
      cvv: '',
    });
    setEditingCustomer(null);
  };

  const handleSubmit = async () => {
    if (!formData.name && !formData.phone) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין לפחות שם או טלפון',
        variant: 'destructive',
      });
      return;
    }

    try {
      let customerId: string | undefined;
      
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          email: formData.email,
          notes: formData.notes,
        });
        customerId = editingCustomer.id;
        toast({
          title: 'לקוח עודכן',
          description: 'פרטי הלקוח עודכנו בהצלחה',
        });
      } else {
        await addCustomer({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          email: formData.email,
          notes: formData.notes,
        });
        toast({
          title: 'לקוח נוסף',
          description: 'הלקוח נוסף למערכת בהצלחה',
        });
      }

      // If credit card details were provided, save the token
      if (formData.creditCard && formData.creditCardExpiry) {
        setIsSavingCard(true);
        
        // Find the customer ID (either from editing or newly created)
        let targetCustomerId = customerId;
        if (!targetCustomerId && !editingCustomer) {
          // Get the latest customer that was just created
          await refreshData();
          const latestCustomer = customers.find(c => c.phone === formData.phone && c.name === formData.name);
          targetCustomerId = latestCustomer?.id;
        }
        
        if (targetCustomerId) {
          try {
            const { data, error } = await supabase.functions.invoke('pelecard-pay', {
              body: {
                amount: 1, // Minimal amount for token validation
                customerName: formData.name,
                customerId: targetCustomerId,
                description: 'שמירת כרטיס אשראי',
                creditCard: formData.creditCard,
                creditCardExpiry: formData.creditCardExpiry,
                cvv: formData.cvv,
                saveTokenOnly: true, // Custom flag to indicate token-only operation
                transactionId: `token-${targetCustomerId}-${Date.now()}`,
              },
            });

            if (error) throw error;

            if (data?.success || data?.tokenSaved) {
              toast({
                title: 'כרטיס נשמר',
                description: 'פרטי הכרטיס נשמרו בהצלחה',
              });
              await refreshData();
            }
          } catch (cardError) {
            console.error('Error saving card:', cardError);
            toast({
              title: 'הערה',
              description: 'הלקוח נוסף אך לא ניתן היה לשמור את הכרטיס',
              variant: 'default',
            });
          }
        }
        setIsSavingCard(false);
      }

      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשמור את הלקוח',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      email: customer.email || '',
      notes: customer.notes || '',
      creditCard: '',
      creditCardExpiry: customer.paymentTokenExpiry || '',
      cvv: '',
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
                <Label>הערות</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="הערות נוספות..."
                />
              </div>

              {/* Credit Card Section */}
              <div className="border-t pt-4 mt-4">
                <Label className="flex items-center gap-2 mb-3 text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  כרטיס אשראי (אופציונלי)
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">מספר כרטיס</Label>
                    <Input
                      value={formData.creditCard}
                      onChange={(e) => setFormData({ ...formData, creditCard: e.target.value })}
                      placeholder="1234567890123456"
                      maxLength={16}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">תוקף (MMYY)</Label>
                    <Input
                      value={formData.creditCardExpiry}
                      onChange={(e) => setFormData({ ...formData, creditCardExpiry: e.target.value })}
                      placeholder="0126"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">CVV</Label>
                    <Input
                      type="password"
                      value={formData.cvv}
                      onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                      placeholder="***"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                {editingCustomer?.hasPaymentToken && (
                  <p className="text-xs text-success mt-2 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    כרטיס שמור: **** {editingCustomer.paymentTokenLast4}
                    {editingCustomer.paymentTokenExpiry && ` (${editingCustomer.paymentTokenExpiry})`}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSubmit} className="flex-1" disabled={isSavingCard}>
                  {isSavingCard ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    editingCustomer ? 'עדכן' : 'הוסף'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(false);
                  }}
                  disabled={isSavingCard}
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

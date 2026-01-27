import { useState } from 'react';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  ShoppingCart,
  RotateCcw,
  Calendar,
  User,
  Package,
  PackagePlus,
  Phone,
  CreditCard,
  Loader2,
  Trash2,
  UserPlus,
  Pencil,
  Printer
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Rental, 
  RentalItem, 
  ItemCategory,
  BundleType,
  categoryLabels, 
  categoryIcons,
  bundleLabels,
  bundleIcons,
  rentalStatusLabels 
} from '@/types/rental';
import { calculateRentalPrice, formatPrice } from '@/lib/pricing';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Rentals() {
  const { 
    rentals, 
    customers, 
    inventory, 
    addRental,
    addCustomer,
    returnRental,
    deleteRental,
    addInventoryItem,
    getAvailableItems 
  } = useRental();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [editFormData, setEditFormData] = useState({
    startDate: '',
    endDate: '',
    deposit: '',
    notes: '',
    status: 'active' as Rental['status'],
    overdueDailyRate: '',
    overdueGraceDays: '0',
    autoChargeEnabled: false,
  });

  const [formData, setFormData] = useState({
    customerId: '',
    startDate: '',
    endDate: '',
    deposit: '',
    notes: '',
  });

  // Quick add customer form
  const [quickCustomerData, setQuickCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const [selectedItems, setSelectedItems] = useState<Array<{
    inventoryItemId: string;
    category: ItemCategory;
    name: string;
    hasIsraeliNumber: boolean;
    isGeneric?: boolean;
  }>>([]);

  // Item selection state
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemCategoryFilter, setItemCategoryFilter] = useState<string>('all');
  
  // Customer search state
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [callingRentalId, setCallingRentalId] = useState<string | null>(null);
  const [payingRentalId, setPayingRentalId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentRental, setPaymentRental] = useState<Rental | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    creditCard: '',
    creditCardExpiry: '',
    cvv: '',
  });
  const [useStoredCard, setUseStoredCard] = useState(false);

  // Notify customer about rental return reminder
  const notifyRentalCustomer = async (rental: Rental) => {
    const customer = customers.find(c => c.id === rental.customerId);
    const customerPhone = customer?.phone;

    if (!customerPhone) {
      toast({
        title: 'שגיאה',
        description: 'אין מספר טלפון ללקוח זה',
        variant: 'destructive',
      });
      return;
    }

    setCallingRentalId(rental.id);

    try {
      const message = `שלום ${rental.customerName}, תזכורת להחזרת הציוד המושכר. תאריך ההחזרה הוא ${format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}. תודה רבה.`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yemot-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            phone: customerPhone,
            message,
            campaignType: 'rental_reminder',
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'ההודעה נשלחה',
          description: `שיחה יוצאת ל-${customerPhone}`,
        });
      } else {
        throw new Error(data.error || 'שגיאה בשליחת ההודעה');
      }
    } catch (error) {
      console.error('Error calling customer:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לשלוח הודעה ללקוח',
        variant: 'destructive',
      });
    } finally {
      setCallingRentalId(null);
    }
  };

  // Open payment dialog
  const openPaymentDialog = (rental: Rental) => {
    setPaymentRental(rental);
    setPaymentFormData({ creditCard: '', creditCardExpiry: '', cvv: '' });
    // Check if customer has stored token
    const customer = customers.find(c => c.id === rental.customerId);
    setUseStoredCard(!!customer?.paymentToken);
    setIsPaymentDialogOpen(true);
  };

  // Get customer for current payment rental
  const getPaymentCustomer = () => {
    if (!paymentRental) return null;
    return customers.find(c => c.id === paymentRental.customerId);
  };

  // Handle payment via Pelecard (direct charge)
  // Generate unique transaction ID for idempotency
  const generateTransactionId = (rentalId: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${rentalId}-${timestamp}-${random}`;
  };

  const handlePayment = async () => {
    if (!paymentRental) return;
    
    const customer = getPaymentCustomer();
    const hasStoredToken = customer?.paymentToken;
    
    // If using stored card, we don't need card details
    if (!useStoredCard) {
      if (!paymentFormData.creditCard || !paymentFormData.creditCardExpiry || !paymentFormData.cvv) {
        toast({
          title: 'שגיאה',
          description: 'יש להזין את כל פרטי הכרטיס',
          variant: 'destructive',
        });
        return;
      }
    } else if (!hasStoredToken) {
      toast({
        title: 'שגיאה',
        description: 'אין כרטיס שמור ללקוח זה',
        variant: 'destructive',
      });
      return;
    }

    setPayingRentalId(paymentRental.id);

    // Generate unique transaction ID for idempotency
    const transactionId = generateTransactionId(paymentRental.id);

    try {
      const paymentBody: Record<string, unknown> = { 
        amount: paymentRental.totalPrice,
        customerName: paymentRental.customerName,
        customerId: paymentRental.customerId,
        description: `השכרה - ${paymentRental.items.map(i => i.itemName).join(', ')}`,
        rentalId: paymentRental.id,
        transactionId: transactionId
      };

      if (useStoredCard && hasStoredToken) {
        paymentBody.token = customer.paymentToken;
      } else {
        paymentBody.creditCard = paymentFormData.creditCard;
        paymentBody.creditCardExpiry = paymentFormData.creditCardExpiry;
        paymentBody.cvv = paymentFormData.cvv;
      }

      const { data, error } = await supabase.functions.invoke('pelecard-pay', {
        body: paymentBody,
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'התשלום בוצע בהצלחה',
          description: `מספר עסקה: ${data.transactionId || transactionId}${data.tokenSaved ? ' (כרטיס נשמר)' : ''}`,
        });
        setIsPaymentDialogOpen(false);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'שגיאה בתשלום',
        description: error instanceof Error ? error.message : 'לא ניתן לבצע תשלום',
        variant: 'destructive',
      });
    } finally {
      setPayingRentalId(null);
    }
  };

  // Quick add inventory state
  const [quickAddData, setQuickAddData] = useState({
    category: 'sim_european' as ItemCategory,
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
  });

  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = 
      rental.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.items.some(i => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || rental.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || rental.items.some(i => i.itemCategory === filterCategory);
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const availableItems = getAvailableItems();

  // Filter available items by search and category
  const filteredAvailableItems = availableItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      categoryLabels[item.category].includes(itemSearchTerm);
    const matchesCategory = itemCategoryFilter === 'all' || item.category === itemCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter customers by search
  const filteredCustomers = customers.filter(customer => {
    const searchLower = customerSearchTerm.toLowerCase();
    return customer.name.toLowerCase().includes(searchLower) ||
           customer.phone.includes(customerSearchTerm);
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      startDate: '',
      endDate: '',
      deposit: '',
      notes: '',
    });
    setSelectedItems([]);
    setItemSearchTerm('');
    setItemCategoryFilter('all');
    setCustomerSearchTerm('');
  };

  // Add bundle items
  const handleAddBundle = (bundleType: BundleType) => {
    const bundleId = `bundle-${Date.now()}`;
    if (bundleType === 'european_sim_simple') {
      setSelectedItems([...selectedItems, 
        { inventoryItemId: `${bundleId}-sim`, category: 'sim_european', name: 'סים אירופאי (באנדל)', hasIsraeliNumber: false, isGeneric: true },
        { inventoryItemId: `${bundleId}-device`, category: 'device_simple', name: 'מכשיר פשוט (באנדל)', hasIsraeliNumber: false, isGeneric: true },
      ]);
    } else if (bundleType === 'european_sim_smartphone') {
      setSelectedItems([...selectedItems, 
        { inventoryItemId: `${bundleId}-sim`, category: 'sim_european', name: 'סים אירופאי (באנדל)', hasIsraeliNumber: false, isGeneric: true },
        { inventoryItemId: `${bundleId}-device`, category: 'device_smartphone', name: 'סמארטפון (באנדל)', hasIsraeliNumber: false, isGeneric: true },
      ]);
    }
    toast({
      title: 'באנדל נוסף',
      description: bundleLabels[bundleType],
    });
  };

  // Add generic item (not linked to inventory)
  const handleAddGenericItem = (category: ItemCategory) => {
    const genericId = `generic-${Date.now()}`;
    setSelectedItems([...selectedItems, {
      inventoryItemId: genericId,
      category,
      name: `${categoryLabels[category]} (כללי)`,
      hasIsraeliNumber: false,
      isGeneric: true,
    }]);
  };

  // Quick add new inventory item
  const handleQuickAddInventory = () => {
    if (!quickAddData.name) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לפריט',
        variant: 'destructive',
      });
      return;
    }
    addInventoryItem({
      category: quickAddData.category,
      name: quickAddData.name,
      localNumber: quickAddData.localNumber || undefined,
      israeliNumber: quickAddData.israeliNumber || undefined,
      expiryDate: quickAddData.expiryDate || undefined,
      status: 'available',
    });
    toast({
      title: 'פריט נוסף למלאי',
      description: `${quickAddData.name} נוסף למלאי`,
    });
    setQuickAddData({ category: 'sim_european', name: '', localNumber: '', israeliNumber: '', expiryDate: '' });
    setIsQuickAddOpen(false);
  };

  // Format phone number for display
  const formatPhoneForPrint = (num: string | undefined): string => {
    if (!num) return '---';
    let cleaned = num;
    if (num.includes('E') || num.includes('e')) {
      const parsed = parseFloat(num);
      if (!isNaN(parsed)) cleaned = parsed.toFixed(0);
    }
    cleaned = cleaned.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length >= 11 && cleaned.startsWith('44')) {
      return `44-${cleaned.slice(2)}`;
    } else if (cleaned.length === 9) {
      return `0${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return num;
  };

  // Handle printing calling instructions - direct print without file download
  const handlePrintInstructions = (itemId: string, israeliNumber?: string, localNumber?: string) => {
    if (!israeliNumber && !localNumber) {
      toast({
        title: 'אין מספרים',
        description: 'לסים זה אין מספר ישראלי או מקומי מוגדר',
        variant: 'destructive',
      });
      return;
    }

    const israeliDisplay = formatPhoneForPrint(israeliNumber);
    const localDisplay = formatPhoneForPrint(localNumber);

    // Create print window with calling instructions matching the Word template
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לפתוח חלון הדפסה. בדוק שחלונות קופצים מותרים.',
        variant: 'destructive',
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>הוראות חיוג מחו"ל לישראל</title>
        <style>
          @page { size: A4; margin: 1cm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: David, 'David Libre', Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background: white;
            color: black;
          }
          .header {
            margin-bottom: 30px;
          }
          .title {
            font-size: 32pt;
            font-weight: bold;
            color: #FF6600;
            margin-bottom: 20px;
          }
          .phone-section {
            margin: 25px 0;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 10px;
          }
          .phone-label {
            font-size: 18pt;
            color: #333;
            margin-bottom: 8px;
          }
          .phone-number {
            font-size: 32pt;
            font-weight: bold;
            direction: ltr;
            display: inline-block;
          }
          .instructions-section {
            margin-top: 40px;
            text-align: right;
            padding: 20px;
            border: 2px solid #FF6600;
            border-radius: 10px;
          }
          .section-title {
            font-size: 24pt;
            font-weight: bold;
            color: #FF6600;
            margin-bottom: 15px;
            text-align: center;
          }
          .instruction-list {
            font-size: 16pt;
            line-height: 2;
            list-style-position: inside;
          }
          .instruction-list li {
            margin: 10px 0;
          }
          .service-section {
            margin-top: 40px;
            padding: 20px;
            background: #FF6600;
            color: white;
            border-radius: 10px;
          }
          .service-title {
            font-size: 24pt;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .service-numbers {
            font-size: 20pt;
            direction: ltr;
            display: inline-block;
            margin: 5px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 3px solid #FF6600;
          }
          .footer-text {
            color: #FF6600;
            font-size: 28pt;
            font-weight: bold;
            margin: 10px 0;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">חיוג מחו"ל לישראל</div>
        </div>
        
        <div class="phone-section">
          <div class="phone-label">מספר ישראלי:</div>
          <div class="phone-number">${israeliDisplay}</div>
        </div>
        
        <div class="phone-section">
          <div class="phone-label">מספר מקומי:</div>
          <div class="phone-number">${localDisplay}</div>
        </div>
        
        <div class="instructions-section">
          <div class="section-title">הוראות חיוג</div>
          <ol class="instruction-list">
            <li>חייגו למספר המקומי (ללא עלות נוספת)</li>
            <li>המתינו לצליל החיוג</li>
            <li>הקישו את המספר הישראלי אליו תרצו להתקשר</li>
            <li>סיימו בלחיצה על # (סולמית)</li>
          </ol>
        </div>
        
        <div class="service-section">
          <div class="service-title">מוקד שירות לקוחות</div>
          <div><span class="service-numbers">0722-163-444</span></div>
          <div><span class="service-numbers">44-203-129-090200</span></div>
        </div>
        
        <div class="footer">
          <div class="footer-text">טיסה נעימה ובטוחה!</div>
          <div class="footer-text">דיל סלולר</div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Print after content loads
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const isSim = (category: ItemCategory) => 
    category === 'sim_american' || category === 'sim_european';

  const handleAddItem = (inventoryItemId: string) => {
    const item = inventory.find(i => i.id === inventoryItemId);
    if (!item) return;

    if (selectedItems.some(i => i.inventoryItemId === inventoryItemId)) {
      toast({
        title: 'הפריט כבר נבחר',
        variant: 'destructive',
      });
      return;
    }

    setSelectedItems([...selectedItems, {
      inventoryItemId: item.id,
      category: item.category,
      name: item.name,
      hasIsraeliNumber: false,
    }]);
  };

  const handleRemoveItem = (inventoryItemId: string) => {
    setSelectedItems(selectedItems.filter(i => i.inventoryItemId !== inventoryItemId));
  };

  const handleToggleIsraeliNumber = (inventoryItemId: string) => {
    setSelectedItems(selectedItems.map(i => 
      i.inventoryItemId === inventoryItemId 
        ? { ...i, hasIsraeliNumber: !i.hasIsraeliNumber }
        : i
    ));
  };

  const calculatePreviewPrice = () => {
    if (!formData.startDate || !formData.endDate || selectedItems.length === 0) {
      return null;
    }

    return calculateRentalPrice(
      selectedItems.map(i => ({ 
        category: i.category, 
        hasIsraeliNumber: i.hasIsraeliNumber 
      })),
      formData.startDate,
      formData.endDate
    );
  };

  const previewPrice = calculatePreviewPrice();

  const handleSubmit = () => {
    if (!formData.customerId) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לקוח',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור תאריכי השכרה',
        variant: 'destructive',
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור לפחות פריט אחד להשכרה',
        variant: 'destructive',
      });
      return;
    }

    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) return;

    const pricing = calculateRentalPrice(
      selectedItems.map(i => ({ category: i.category, hasIsraeliNumber: i.hasIsraeliNumber })),
      formData.startDate,
      formData.endDate
    );

    const rentalItems: RentalItem[] = selectedItems.map(item => ({
      inventoryItemId: item.inventoryItemId,
      itemCategory: item.category,
      itemName: item.name,
      hasIsraeliNumber: item.hasIsraeliNumber,
      isGeneric: item.isGeneric,
    }));

    addRental({
      customerId: customer.id,
      customerName: customer.name,
      items: rentalItems,
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalPrice: pricing.total,
      currency: pricing.currency,
      status: 'active',
      deposit: formData.deposit ? parseFloat(formData.deposit) : undefined,
      notes: formData.notes,
    });

    toast({
      title: 'השכרה נוצרה',
      description: `השכרה חדשה נוצרה עבור ${customer.name}`,
    });

    // Close dialog first, then reset form
    setIsAddDialogOpen(false);
    // Reset form after a short delay to ensure state is cleared properly
    setTimeout(() => {
      resetForm();
    }, 100);
  };

  const handleReturn = (rentalId: string) => {
    returnRental(rentalId);
    toast({
      title: 'השכרה הוחזרה',
      description: 'הפריטים הוחזרו למלאי',
    });
  };

  const handleDeleteRental = (rentalId: string, customerName: string) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את ההשכרה של ${customerName}?`)) {
      deleteRental(rentalId);
      toast({
        title: 'השכרה נמחקה',
        description: 'ההשכרה נמחקה מהמערכת',
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (rental: Rental) => {
    setEditingRental(rental);
    setEditFormData({
      startDate: rental.startDate,
      endDate: rental.endDate,
      deposit: rental.deposit?.toString() || '',
      notes: rental.notes || '',
      status: rental.status,
      overdueDailyRate: rental.overdueDailyRate?.toString() || '',
      overdueGraceDays: (rental.overdueGraceDays ?? 0).toString(),
      autoChargeEnabled: rental.autoChargeEnabled ?? false,
    });
    setIsEditDialogOpen(true);
  };

  // Handle edit rental
  const handleEditRental = async () => {
    if (!editingRental) return;

    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          start_date: editFormData.startDate,
          end_date: editFormData.endDate,
          deposit: editFormData.deposit ? parseFloat(editFormData.deposit) : null,
          notes: editFormData.notes || null,
          status: editFormData.status,
          overdue_daily_rate: editFormData.overdueDailyRate ? parseFloat(editFormData.overdueDailyRate) : null,
          overdue_grace_days: parseInt(editFormData.overdueGraceDays) || 0,
          auto_charge_enabled: editFormData.autoChargeEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRental.id);

      if (error) throw error;

      toast({
        title: 'השכרה עודכנה',
        description: 'פרטי ההשכרה עודכנו בהצלחה',
      });
      setIsEditDialogOpen(false);
      setEditingRental(null);
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error updating rental:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את ההשכרה',
        variant: 'destructive',
      });
    }
  };

  const handleQuickAddCustomer = async () => {
    if (!quickCustomerData.name || !quickCustomerData.phone) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם וטלפון',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addCustomer({
        name: quickCustomerData.name,
        phone: quickCustomerData.phone,
        address: quickCustomerData.address || undefined,
      });
      
      // Get the newly added customer (it should be first in the list after refresh)
      toast({
        title: 'לקוח נוסף',
        description: `${quickCustomerData.name} נוסף בהצלחה`,
      });
      
      setQuickCustomerData({ name: '', phone: '', address: '' });
      setIsQuickAddCustomerOpen(false);
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להוסיף לקוח',
        variant: 'destructive',
      });
    }
  };

  const getStatusVariant = (status: Rental['status']) => {
    switch (status) {
      case 'active': return 'info';
      case 'overdue': return 'destructive';
      case 'returned': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="ניהול השכרות" 
        description="יצירה וניהול השכרות קיימות"
      >
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="glow" size="lg">
              <Plus className="h-5 w-5" />
              השכרה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>יצירת השכרה חדשה</DialogTitle>
              <DialogDescription>מלא את הפרטים ליצירת השכרה חדשה</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* Customer Selection with Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    בחר לקוח *
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsQuickAddCustomerOpen(true)}
                    className="h-7 text-xs"
                  >
                    <UserPlus className="h-3 w-3" />
                    הוסף לקוח חדש
                  </Button>
                </div>
                
                {/* Customer Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="חפש לקוח לפי שם או טלפון..."
                    className="pr-10"
                  />
                </div>

                {/* Customer List */}
                <div className="max-h-40 overflow-y-auto border rounded-lg bg-muted/30">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4 text-sm">
                      {customers.length === 0 ? 'אין לקוחות במערכת' : 'לא נמצאו לקוחות'}
                    </p>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, customerId: customer.id })}
                        className={`w-full flex items-center justify-between p-3 hover:bg-muted text-right transition-colors border-b last:border-b-0 ${
                          formData.customerId === customer.id ? 'bg-primary/10 border-primary/30' : ''
                        }`}
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
                        {formData.customerId === customer.id && (
                          <span className="text-xs text-primary font-medium">נבחר ✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך התחלה *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך סיום *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>



              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    בחר פריטים להשכרה *
                  </Label>
                  <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <PackagePlus className="h-4 w-4" />
                        הוסף למלאי
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>הוספה מהירה למלאי</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>קטגוריה</Label>
                          <Select 
                            value={quickAddData.category} 
                            onValueChange={(value: ItemCategory) => setQuickAddData({ ...quickAddData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(categoryLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {categoryIcons[key as ItemCategory]} {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>שם הפריט</Label>
                          <Input
                            value={quickAddData.name}
                            onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
                            placeholder="לדוגמה: סים אירופאי #002"
                          />
                        </div>

                        {isSim(quickAddData.category) && (
                          <>
                            <div className="space-y-2">
                              <Label>מספר מקומי</Label>
                              <Input
                                value={quickAddData.localNumber}
                                onChange={(e) => setQuickAddData({ ...quickAddData, localNumber: e.target.value })}
                                placeholder="+44-7700-900123"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>מספר ישראלי</Label>
                              <Input
                                value={quickAddData.israeliNumber}
                                onChange={(e) => setQuickAddData({ ...quickAddData, israeliNumber: e.target.value })}
                                placeholder="050-0001111"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>תוקף</Label>
                              <Input
                                type="date"
                                value={quickAddData.expiryDate}
                                onChange={(e) => setQuickAddData({ ...quickAddData, expiryDate: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        <Button onClick={handleQuickAddInventory} className="w-full">
                          הוסף למלאי
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Quick Bundles - Prominent Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleAddBundle('european_sim_simple')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-2 text-2xl">
                      <span>🇪🇺</span>
                      <span>+</span>
                      <span>📱</span>
                    </div>
                    <span className="text-sm font-medium text-primary">סים אירופאי + מכשיר פשוט</span>
                    <span className="text-xs text-muted-foreground">באנדל מוזל</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddBundle('european_sim_smartphone')}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-secondary/50 bg-secondary/10 hover:bg-secondary/20 hover:border-secondary transition-all"
                  >
                    <div className="flex items-center gap-2 text-2xl">
                      <span>🇪🇺</span>
                      <span>+</span>
                      <span>📲</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">סים אירופאי + סמארטפון</span>
                    <span className="text-xs text-muted-foreground">באנדל מוזל</span>
                  </button>
                </div>

                {/* Generic Items - Category Cards */}
                <div>
                  <p className="text-sm text-muted-foreground mb-2">או הוסף פריט כללי:</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <button 
                        key={key}
                        type="button"
                        onClick={() => handleAddGenericItem(key as ItemCategory)}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                      >
                        <span className="text-2xl">{categoryIcons[key as ItemCategory]}</span>
                        <span className="text-xs text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Inventory Items Section */}
                <div className="border rounded-xl p-4 bg-card">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    בחר מהמלאי
                  </p>
                  
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <Select value={itemCategoryFilter} onValueChange={setItemCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="כל הקטגוריות" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">כל הקטגוריות</SelectItem>
                        <SelectItem value="sim_american">🇺🇸 סים אמריקאי</SelectItem>
                        <SelectItem value="sim_european">🇪🇺 סים אירופאי</SelectItem>
                        <SelectItem value="device_simple">📱 מכשיר פשוט</SelectItem>
                        <SelectItem value="device_smartphone">📲 סמארטפון</SelectItem>
                        <SelectItem value="modem">📡 מודם</SelectItem>
                        <SelectItem value="netstick">📶 נטסטיק</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="relative flex-1">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={itemSearchTerm}
                        onChange={(e) => setItemSearchTerm(e.target.value)}
                        placeholder="חפש מוצר..."
                        className="pr-10"
                      />
                    </div>
                  </div>

                  {/* Items Grid */}
                  <div className="max-h-48 overflow-y-auto">
                    {filteredAvailableItems.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-muted-foreground text-sm">
                          {availableItems.length === 0 ? 'אין פריטים זמינים במלאי' : 'לא נמצאו פריטים'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredAvailableItems.map((item) => {
                          const isSelected = selectedItems.some(i => i.inventoryItemId === item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleAddItem(item.id)}
                              disabled={isSelected}
                              className={`flex items-center gap-3 p-3 rounded-lg text-right transition-all ${
                                isSelected 
                                  ? 'bg-primary/10 border-2 border-primary/30 cursor-default' 
                                  : 'bg-muted/50 hover:bg-muted border-2 border-transparent hover:border-primary/20'
                              }`}
                            >
                              <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center text-xl shrink-0">
                                {categoryIcons[item.category]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{categoryLabels[item.category]}</p>
                              </div>
                              {isSelected ? (
                                <span className="text-xs text-primary font-medium shrink-0">✓</span>
                              ) : (
                                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <Label>פריטים נבחרים</Label>
                  <div className="space-y-2">
                    {selectedItems.map((item) => {
                      // Check if this is a European SIM from inventory (not generic)
                      const isEuropeanSimFromInventory = item.category === 'sim_european' && !item.isGeneric;
                      const inventoryItem = isEuropeanSimFromInventory 
                        ? inventory.find(i => i.id === item.inventoryItemId)
                        : null;

                      return (
                        <div 
                          key={item.inventoryItemId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{categoryIcons[item.category]}</span>
                            <div>
                              <p className="font-medium text-foreground">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{categoryLabels[item.category]}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.category === 'sim_american' && (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={item.hasIsraeliNumber}
                                  onCheckedChange={() => handleToggleIsraeliNumber(item.inventoryItemId)}
                                />
                                <Label className="text-sm">מספר ישראלי (+$10)</Label>
                              </div>
                            )}
                            {/* Print calling instructions for European SIM from inventory */}
                            {isEuropeanSimFromInventory && inventoryItem && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePrintInstructions(
                                  item.inventoryItemId,
                                  inventoryItem.israeliNumber || undefined,
                                  inventoryItem.localNumber || undefined
                                )}
                                className="gap-1 text-xs"
                              >
                                <Printer className="h-3 w-3" />
                                הדפס הוראות
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item.inventoryItemId)}
                            >
                              הסר
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Preview */}
              {previewPrice && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-2">פירוט מחיר:</p>
                  {previewPrice.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.item}</span>
                      <span>{item.currency}{item.price}</span>
                    </div>
                  ))}
                  <div className="border-t border-primary/20 mt-2 pt-2 flex justify-between font-bold">
                    <span>סה"כ</span>
                    <span className="text-primary">{formatPrice(previewPrice.total, previewPrice.currency)}</span>
                  </div>
                </div>
              )}

              {/* Deposit */}
              <div className="space-y-2">
                <Label>פיקדון</Label>
                <Input
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                  placeholder="סכום הפיקדון"
                />
              </div>

              {/* Notes */}
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
                  צור השכרה
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

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם לקוח או פריט..."
            className="pr-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="overdue">באיחור</SelectItem>
            <SelectItem value="returned">הוחזר</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="כל הקטגוריות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            <SelectItem value="sim_american">🇺🇸 סים אמריקאי</SelectItem>
            <SelectItem value="sim_european">🇪🇺 סים אירופאי</SelectItem>
            <SelectItem value="device_simple">📱 מכשיר פשוט</SelectItem>
            <SelectItem value="device_smartphone">📲 סמארטפון</SelectItem>
            <SelectItem value="modem">📡 מודם</SelectItem>
            <SelectItem value="netstick">📶 נטסטיק</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rentals List */}
      {filteredRentals.length === 0 ? (
        <div className="stat-card text-center py-12">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">אין השכרות</p>
          <p className="text-muted-foreground">צור השכרה חדשה כדי להתחיל</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRentals.map((rental, index) => (
            <div 
              key={rental.id}
              className={`stat-card hover:border-primary/30 transition-all duration-200 p-5 flex flex-col min-h-[280px] border-r-4 animate-slide-up ${
                rental.status === 'active' ? 'border-r-primary' :
                rental.status === 'overdue' ? 'border-r-destructive' :
                'border-r-success'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Header - Status, Edit and Delete */}
              <div className="flex items-center justify-between mb-4">
                <StatusBadge 
                  status={rentalStatusLabels[rental.status]} 
                  variant={getStatusVariant(rental.status)} 
                />
                <div className="flex gap-1">
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(rental)}
                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {rental.status === 'returned' && (
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRental(rental.id, rental.customerName)}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <p className="font-bold text-base text-foreground truncate flex-1">{rental.customerName}</p>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Calendar className="h-4 w-4" />
                <span>{format(parseISO(rental.startDate), 'dd/MM/yyyy', { locale: he })} - {format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}</span>
              </div>

              {/* Items */}
              <div className="flex flex-wrap gap-2 mb-4 flex-1">
                {rental.items.map((item, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-sm"
                    title={item.itemName}
                  >
                    {categoryIcons[item.itemCategory]}
                    <span className="text-xs text-muted-foreground truncate max-w-[80px]">{item.itemName}</span>
                  </span>
                ))}
              </div>

              {/* Price */}
              <div className="text-center mb-4 py-2 rounded-lg bg-primary/5">
                <p className="text-xl font-bold text-primary">
                  {formatPrice(rental.totalPrice, rental.currency)}
                </p>
              </div>

              {/* Phone Numbers Display & Download Instructions for European SIM */}
              {rental.items.some(item => item.itemCategory === 'sim_european' && !item.isGeneric && item.inventoryItemId) && (() => {
                const europeanSimItem = rental.items.find(item => item.itemCategory === 'sim_european' && !item.isGeneric && item.inventoryItemId);
                const inventoryItem = europeanSimItem ? inventory.find(i => i.id === europeanSimItem.inventoryItemId) : null;
                const itemId = `rental-${rental.id}`;
                
                // Format phone numbers for display
                const formatDisplayNumber = (num: string | undefined): string => {
                  if (!num) return '---';
                  let cleaned = num;
                  if (num.includes('E') || num.includes('e')) {
                    const parsed = parseFloat(num);
                    if (!isNaN(parsed)) cleaned = parsed.toFixed(0);
                  }
                  cleaned = cleaned.replace(/\D/g, '');
                  if (cleaned.length === 10) {
                    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
                  } else if (cleaned.length >= 11 && cleaned.startsWith('44')) {
                    return `44-${cleaned.slice(2)}`;
                  } else if (cleaned.length === 9) {
                    return `0${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                  }
                  return num;
                };
                
                return (
                  <div className="mb-3 space-y-2">
                    {/* Phone Numbers Display */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/50">
                      <div className="text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <span className="text-muted-foreground">🇮🇱 ישראלי:</span>
                          <span className="font-bold text-primary" dir="ltr">
                            {formatDisplayNumber(inventoryItem?.israeliNumber)}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <span className="text-muted-foreground">🌍 מקומי:</span>
                          <span className="font-bold text-primary" dir="ltr">
                            {formatDisplayNumber(inventoryItem?.localNumber)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Print Button */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          let israeliNumber = inventoryItem?.israeliNumber;
                          let localNumber = inventoryItem?.localNumber;
                          
                          if (!inventoryItem && europeanSimItem?.inventoryItemId) {
                            const { data } = await supabase
                              .from('inventory')
                              .select('israeli_number, local_number')
                              .eq('id', europeanSimItem.inventoryItemId)
                              .maybeSingle();
                            if (data) {
                              israeliNumber = data.israeli_number || undefined;
                              localNumber = data.local_number || undefined;
                            }
                          }
                          
                          handlePrintInstructions(itemId, israeliNumber || undefined, localNumber || undefined);
                        }}
                        className="gap-1 text-xs w-full"
                      >
                        <Printer className="h-3 w-3" />
                        הדפס הוראות חיוג
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Actions - Always visible for active/overdue */}
              {(rental.status === 'active' || rental.status === 'overdue') && (
                <div className="flex justify-center gap-2 mt-auto pt-3 border-t border-border">
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={() => openPaymentDialog(rental)}
                    disabled={payingRentalId === rental.id}
                    className="flex-1"
                  >
                    {payingRentalId === rental.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 ml-1" />
                        תשלום
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => notifyRentalCustomer(rental)}
                    disabled={callingRentalId === rental.id}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handleReturn(rental.id)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Rental Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת השכרה</DialogTitle>
            <DialogDescription>
              {editingRental && `עריכת השכרה של ${editingRental.customerName}`}
            </DialogDescription>
          </DialogHeader>
          {editingRental && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך התחלה</Label>
                  <Input
                    type="date"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>תאריך סיום</Label>
                  <Input
                    type="date"
                    value={editFormData.endDate}
                    onChange={(e) => setEditFormData({ ...editFormData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select value={editFormData.status} onValueChange={(value: Rental['status']) => setEditFormData({ ...editFormData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="overdue">באיחור</SelectItem>
                    <SelectItem value="returned">הוחזר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>פיקדון</Label>
                <Input
                  type="number"
                  value={editFormData.deposit}
                  onChange={(e) => setEditFormData({ ...editFormData, deposit: e.target.value })}
                  placeholder="סכום הפיקדון"
                />
              </div>

              <div className="space-y-2">
                <Label>הערות</Label>
                <Input
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="הערות נוספות"
                />
              </div>

              {/* Overdue Charging Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-sm mb-3">חיוב אוטומטי על איחור</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>סכום ליום איחור (₪)</Label>
                    <Input
                      type="number"
                      value={editFormData.overdueDailyRate}
                      onChange={(e) => setEditFormData({ ...editFormData, overdueDailyRate: e.target.value })}
                      placeholder="למשל: 50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ימי חסד</Label>
                    <Input
                      type="number"
                      value={editFormData.overdueGraceDays}
                      onChange={(e) => setEditFormData({ ...editFormData, overdueGraceDays: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Checkbox
                    id="autoChargeEnabled"
                    checked={editFormData.autoChargeEnabled}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, autoChargeEnabled: checked === true })}
                  />
                  <Label htmlFor="autoChargeEnabled" className="text-sm cursor-pointer">
                    חייב אוטומטית (רק ללקוחות עם כרטיס שמור)
                  </Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleEditRental} className="flex-1">
                  שמור שינויים
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>תשלום עבור השכרה</DialogTitle>
            <DialogDescription>הזן פרטי כרטיס אשראי לביצוע התשלום</DialogDescription>
          </DialogHeader>
          {paymentRental && (() => {
            const customer = getPaymentCustomer();
            const hasStoredToken = customer?.paymentToken;
            
            return (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium">{paymentRental.customerName}</p>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(paymentRental.totalPrice, paymentRental.currency)}
                </p>
              </div>

              {/* Stored card option */}
              {hasStoredToken && (
                <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="useStoredCard"
                      checked={useStoredCard}
                      onCheckedChange={(checked) => setUseStoredCard(!!checked)}
                    />
                    <Label htmlFor="useStoredCard" className="flex-1 cursor-pointer">
                      <span className="font-medium">השתמש בכרטיס שמור</span>
                      <span className="block text-sm text-muted-foreground" dir="ltr">
                        •••• {customer.paymentTokenLast4} | {customer.paymentTokenExpiry}
                      </span>
                    </Label>
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}

              {/* Manual card entry - hidden when using stored card */}
              {!useStoredCard && (
                <>
                  <div className="space-y-2">
                    <Label>מספר כרטיס אשראי</Label>
                    <Input
                      value={paymentFormData.creditCard}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, creditCard: e.target.value })}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>תוקף (MMYY)</Label>
                      <Input
                        value={paymentFormData.creditCardExpiry}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, creditCardExpiry: e.target.value })}
                        placeholder="0126"
                        maxLength={4}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV</Label>
                      <Input
                        value={paymentFormData.cvv}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, cvv: e.target.value })}
                        placeholder="123"
                        maxLength={4}
                        type="password"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handlePayment} 
                  className="flex-1"
                  disabled={payingRentalId === paymentRental.id}
                >
                  {payingRentalId === paymentRental.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      מעבד תשלום...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      {useStoredCard ? 'חייב כרטיס שמור' : 'בצע תשלום'}
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsPaymentDialogOpen(false)}
                  disabled={payingRentalId === paymentRental.id}
                >
                  ביטול
                </Button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog open={isQuickAddCustomerOpen} onOpenChange={setIsQuickAddCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              הוספת לקוח חדש
            </DialogTitle>
            <DialogDescription>הוסף לקוח חדש במהירות לבחירה בהשכרה</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>שם הלקוח *</Label>
              <Input
                value={quickCustomerData.name}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, name: e.target.value })}
                placeholder="שם מלא"
              />
            </div>
            
            <div className="space-y-2">
              <Label>טלפון *</Label>
              <Input
                value={quickCustomerData.phone}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>
            
            <div className="space-y-2">
              <Label>כתובת</Label>
              <Input
                value={quickCustomerData.address}
                onChange={(e) => setQuickCustomerData({ ...quickCustomerData, address: e.target.value })}
                placeholder="כתובת (אופציונלי)"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button onClick={handleQuickAddCustomer} className="flex-1">
                <UserPlus className="h-4 w-4" />
                הוסף לקוח
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setQuickCustomerData({ name: '', phone: '', address: '' });
                  setIsQuickAddCustomerOpen(false);
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

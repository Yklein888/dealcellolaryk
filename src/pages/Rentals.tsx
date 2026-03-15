import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { InventoryItem } from '@/types/rental';
import { PACKAGE_LABELS, USSimPackage } from '@/types/rental';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { CallHistoryBadge } from '@/components/CallHistoryBadge';
import { NewRentalDialog } from '@/components/rentals/NewRentalDialog';
import { EditRentalDialog } from '@/components/rentals/EditRentalDialog';
import { PaymentConfirmationDialog } from '@/components/rentals/PaymentConfirmationDialog';
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
  Phone,
  CreditCard,
  Loader2,
  Trash2,
  Pencil,
  Printer,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Package,
  CalendarPlus,
} from 'lucide-react';
import { printCallingInstructions, downloadCallingInstructions } from '@/lib/callingInstructions';
import { supabase } from '@/integrations/supabase/client';
import { 
  Rental, 
  RentalItem, 
  ItemCategory,
  categoryLabels, 
  categoryIcons,
  rentalStatusLabels 
} from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { he } from 'date-fns/locale';
import { DualCurrencyPrice } from '@/components/DualCurrencyPrice';


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
    getAvailableItems,
    loading,
    usSims
  } = useRental();
  const { toast } = useToast();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [preSelectedItem, setPreSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);

  const [callingRentalId, setCallingRentalId] = useState<string | null>(null);
  const [downloadingInstructions, setDownloadingInstructions] = useState<string | null>(null);
  const [payingRentalId, setPayingRentalId] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentRental, setPaymentRental] = useState<Rental | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    creditCard: '',
    creditCardExpiry: '',
    cvv: '',
  });
  const [useStoredCard, setUseStoredCard] = useState(false);
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [terminalStatus, setTerminalStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  
  // Payment confirmation dialog state (for saved card payments)
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [confirmedPaymentAmount, setConfirmedPaymentAmount] = useState<number | null>(null);

  // Extension dialog state
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
  const [extendNewEndDate, setExtendNewEndDate] = useState<Date | null>(null);
  const [isExtending, setIsExtending] = useState(false);


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
        `/api/yemot-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: customerPhone,
            message,
            campaignType: 'rental_reminder',
            entityType: 'rental',
            entityId: rental.id,
            customerId: rental.customerId,
            callType: 'manual',
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
    // Check if customer has stored token (using the secure hasPaymentToken flag)
    const customer = customers.find(c => c.id === rental.customerId);
    setUseStoredCard(!!customer?.hasPaymentToken);
    setIsTerminalMode(false);
    setTerminalStatus('idle');
    setIsPaymentDialogOpen(true);
  };

  // Handle terminal payment
  const handleTerminalPayment = async () => {
    if (!paymentRental) return;
    
    setTerminalStatus('waiting');
    
    // Note: This requires Pelecard ECR terminal integration
    // Currently showing a placeholder - real implementation needs:
    // 1. Terminal IP/connection configuration  
    // 2. Pelecard ECR protocol implementation
    // 3. Webhook or polling for transaction result
    
    toast({
      title: 'שידור למסוף',
      description: 'נשלחה בקשה למסוף הסליקה. אנא השתמש בכרטיס במסוף.',
    });
    
    // Simulate terminal processing (placeholder)
    setTimeout(() => {
      setTerminalStatus('idle');
      toast({
        title: 'הערה',
        description: 'שילוב מסוף פיזי דורש הגדרת חיבור עם פלאכארד. פנה לתמיכה.',
        variant: 'default',
      });
    }, 3000);
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

  // Handle initiating payment - opens confirmation for saved cards
  const handlePaymentClick = () => {
    if (!paymentRental) return;
    
    const customer = getPaymentCustomer();
    const hasStoredToken = customer?.hasPaymentToken;
    
    // If using stored card, show confirmation dialog first
    if (useStoredCard && hasStoredToken) {
      setConfirmedPaymentAmount(null);
      setIsPaymentConfirmOpen(true);
      return;
    }
    
    // Otherwise, process payment directly
    handlePayment(paymentRental.totalPrice);
  };

  // Handle confirmed payment with amount (from confirmation dialog or direct)
  const handlePayment = async (amount: number) => {
    if (!paymentRental) return;
    
    const customer = getPaymentCustomer();
    const hasStoredToken = customer?.hasPaymentToken;
    
    // If using stored card, close confirmation dialog
    if (useStoredCard && hasStoredToken) {
      setIsPaymentConfirmOpen(false);
    }
    
    // Validate card details for non-token payments
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
        amount: amount, // Use the confirmed/edited amount
        customerName: paymentRental.customerName,
        customerId: paymentRental.customerId,
        description: `השכרה - ${paymentRental.items.map(i => i.itemName).join(', ')}`,
        rentalId: paymentRental.id,
        transactionId: transactionId
      };

      if (useStoredCard && hasStoredToken) {
        // Token payment - backend will fetch the actual token securely
        paymentBody.useStoredToken = true;
      } else {
        paymentBody.creditCard = paymentFormData.creditCard;
        paymentBody.creditCardExpiry = paymentFormData.creditCardExpiry;
        paymentBody.cvv = paymentFormData.cvv;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/pelecard-pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(paymentBody),
      });

      const data = response.ok ? await response.json() : null;
      if (!response.ok) throw new Error(data?.error || 'Payment failed');

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

  // Read URL params on mount
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
      // Clear the URL param after applying
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Handle direct navigation from global search
  useEffect(() => {
    if (location.state?.addItemToRental) {
      const item = location.state.addItemToRental as InventoryItem;
      setPreSelectedItem(item);
      setIsAddDialogOpen(true);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Custom filter logic to handle special statuses like ending_today and upcoming
  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = 
      rental.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.items.some(i => i.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Handle special filter statuses
    let matchesStatus = true;
    if (filterStatus === 'all') {
      // ב-all מסתירים returned - מוצג רק כשלוחצים על 'הוחזרו'
      matchesStatus = rental.status !== 'returned';
    } else if (filterStatus === 'ending_today') {
      // Rentals ending exactly today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfTomorrow = addDays(today, 1);
      const endDate = parseISO(rental.endDate);
      matchesStatus = rental.status === 'active' && !isBefore(endDate, today) && isBefore(endDate, startOfTomorrow);
    } else if (filterStatus === 'upcoming') {
      // Upcoming returns (next 3 days, not including today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfTomorrow = addDays(today, 1);
      const threeDaysFromNow = addDays(today, 3);
      const endDate = parseISO(rental.endDate);
      matchesStatus = rental.status === 'active' && !isBefore(endDate, startOfTomorrow) && isBefore(endDate, threeDaysFromNow);
    } else if (filterStatus === 'overdue') {
      // Overdue = endDate before today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = parseISO(rental.endDate);
      matchesStatus = rental.status === 'active' && isBefore(endDate, today);
    } else {
      matchesStatus = rental.status === filterStatus;
    }
    
    const matchesCategory = filterCategory === 'all' || rental.items.some(i => i.itemCategory === filterCategory);
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Convert active US SIMs to InventoryItem format
  // This makes them appear in the rental dialog alongside regular inventory items
  const activeUSSimsAsInventory = useMemo<InventoryItem[]>(() =>
    usSims
      .filter(s => s.status === 'active')
      .map(s => ({
        id: `us-sim-${s.id}`,
        category: 'sim_american' as const,
        name: `${s.simCompany}${s.package ? ` – ${PACKAGE_LABELS[s.package as USSimPackage] ?? s.package}` : ''}`,
        localNumber: s.localNumber,
        israeliNumber: s.includesIsraeliNumber ? s.israeliNumber : undefined,
        expiryDate: s.expiryDate,
        simNumber: s.simNumber,
        status: 'available',
        notes: s.notes,
      })),
    [usSims]
  );

  const availableItems = [...getAvailableItems(), ...activeUSSimsAsInventory];

  // Handle printing calling instructions for rental cards
  const handlePrintInstructions = async (
    itemId: string, 
    israeliNumber?: string, 
    localNumber?: string, 
    barcode?: string, 
    isAmericanSim?: boolean,
    packageName?: string,
    expiryDate?: string,
    simNumber?: string
  ) => {
    if (!israeliNumber && !localNumber) {
      toast({
        title: 'אין מספרים',
        description: 'לסים זה אין מספר ישראלי או מקומי מוגדר',
        variant: 'destructive',
      });
      return;
    }

    setDownloadingInstructions(itemId);

    try {
      await printCallingInstructions(israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate, simNumber);
      toast({
        title: 'פותח חלון הדפסה',
        description: 'בחר מדפסת והדפס את ההוראות',
      });
    } catch (error) {
      console.error('Error printing instructions:', error);
      toast({
        title: 'שגיאה בהדפסה',
        description: 'מנסה להוריד כקובץ במקום...',
        variant: 'destructive',
      });
      // Fallback to download
      try {
        await downloadCallingInstructions(israeliNumber, localNumber, barcode, isAmericanSim, packageName, expiryDate, simNumber);
        toast({
          title: 'הקובץ הורד',
          description: 'פתח את הקובץ והדפס אותו ידנית',
        });
      } catch (downloadError) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן ליצור את קובץ ההוראות',
          variant: 'destructive',
        });
      }
    } finally {
      setDownloadingInstructions(null);
    }
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
    setIsEditDialogOpen(true);
  };

  // Open extend dialog
  const openExtendDialog = (rental: Rental) => {
    setExtendingRental(rental);
    // Set default to current end date + 7 days
    setExtendNewEndDate(addDays(parseISO(rental.endDate), 7));
    setExtendDialogOpen(true);
  };

  // Handle extend rental
  const handleExtendRental = async () => {
    if (!extendingRental || !extendNewEndDate) return;

    setIsExtending(true);

    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          end_date: format(extendNewEndDate, 'yyyy-MM-dd'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', extendingRental.id);

      if (error) throw error;

      toast({
        title: 'ההשכרה הוארכה',
        description: `תאריך ההחזרה החדש: ${format(extendNewEndDate, 'dd/MM/yyyy', { locale: he })}`,
      });
      setExtendDialogOpen(false);
      setExtendingRental(null);
      setExtendNewEndDate(null);
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error extending rental:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן להאריך את ההשכרה',
        variant: 'destructive',
      });
    } finally {
      setIsExtending(false);
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

  if (loading) return <PageLoadingSkeleton columns={3} rows={6} showStats={true} />;

  return (
    <div>
      <PageHeader 
        title="ניהול השכרות" 
        description="יצירה וניהול השכרות קיימות"
      >
        <Button variant="glow" size="lg" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-5 w-5" />
          השכרה חדשה
        </Button>
        <NewRentalDialog
          isOpen={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) setPreSelectedItem(null);
          }}
          customers={customers}
          inventory={inventory}
          availableItems={availableItems}
          preSelectedItem={preSelectedItem}
          onAddRental={addRental}
          onAddCustomer={addCustomer}
          onAddInventoryItem={addInventoryItem}
        />
      </PageHeader>


      {/* Status Quick Access */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            key: 'active',
            label: 'פעילות',
            icon: ShoppingCart,
            count: rentals.filter(r => r.status === 'active').length,
            activeColor: { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', iconBg: '#3B82F6' },
            inactiveColor: { bg: '#FFFFFF', border: '#E5E7EB', text: '#374151', iconBg: '#F3F4F6' },
          },
          {
            key: 'overdue',
            label: 'באיחור',
            icon: AlertTriangle,
            count: rentals.filter(r => {
              const today = new Date(); today.setHours(0,0,0,0);
              return r.status === 'active' && isBefore(parseISO(r.endDate), today);
            }).length,
            activeColor: { bg: '#FFF1F2', border: '#EF4444', text: '#B91C1C', iconBg: '#EF4444' },
            inactiveColor: { bg: '#FFFFFF', border: '#E5E7EB', text: '#374151', iconBg: '#F3F4F6' },
          },
          {
            key: 'returned',
            label: 'הוחזרו',
            icon: CheckCircle,
            count: rentals.filter(r => r.status === 'returned').length,
            activeColor: { bg: '#F0FDF4', border: '#22C55E', text: '#15803D', iconBg: '#22C55E' },
            inactiveColor: { bg: '#FFFFFF', border: '#E5E7EB', text: '#374151', iconBg: '#F3F4F6' },
          },
        ].map(({ key, label, icon: Icon, count, activeColor, inactiveColor }) => {
          const isActive = filterStatus === key;
          const c = isActive ? activeColor : inactiveColor;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(isActive ? 'all' : key)}
              style={{
                background: c.bg,
                border: `1.5px solid ${c.border}`,
                borderRadius: 14,
                padding: '16px 12px',
                cursor: 'pointer',
                transition: 'all 0.18s',
                textAlign: 'center',
                boxShadow: isActive ? `0 4px 12px ${c.border}30` : '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon style={{ width: 16, height: 16, color: 'white' }} />
                </div>
                <span style={{ fontSize: 28, fontWeight: 800, color: c.text, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>{count}</span>
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: isActive ? c.text : '#6B7280', margin: 0 }}>{label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24,
          padding: '14px 16px', background: '#FFFFFF', borderRadius: 14,
          border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9CA3AF' }} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם לקוח או פריט..."
            style={{ paddingRight: 40, height: 40, borderRadius: 10, fontSize: 14, border: '1px solid #E5E7EB', background: '#F9FAFB' }}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger style={{ width: 160, height: 40, borderRadius: 10, fontSize: 14, border: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="overdue">באיחור</SelectItem>
            <SelectItem value="returned">הוחזר</SelectItem>
          </SelectContent>
        </Select>
        {/* Category chips */}
        <div style={{ width: '100%', display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #F3F4F6' }}>
          {[
            { value: 'all',              label: 'הכל',          emoji: '🔀' },
            { value: 'sim_american',     label: 'SIM אמריקאי',  emoji: '🇺🇸' },
            { value: 'sim_european',     label: 'SIM אירופאי',  emoji: '🇪🇺' },
            { value: 'device_simple',    label: 'מכשיר פשוט',   emoji: '📱' },
            { value: 'device_smartphone',label: 'סמארטפון',     emoji: '📲' },
            { value: 'modem',            label: 'מודם',          emoji: '📡' },
            { value: 'netstick',         label: 'נטסטיק',        emoji: '📶' },
          ].map(({ value, label, emoji }) => {
            const isActive = filterCategory === value;
            return (
              <button
                key={value}
                onClick={() => setFilterCategory(value)}
                style={{
                  height: 32,
                  paddingInline: 12,
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s',
                  border: isActive ? '1.5px solid #0D9488' : '1.5px solid #E5E7EB',
                  background: isActive ? '#F0FDFA' : '#F9FAFB',
                  color: isActive ? '#0F766E' : '#6B7280',
                  boxShadow: isActive ? '0 2px 8px rgba(13,148,136,0.18)' : 'none',
                }}
              >
                <span style={{ fontSize: 15 }}>{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rentals List */}
      {rentals.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="אין השכרות עדיין"
          description="צור השכרה ראשונה ועקוב אחרי כל הציוד המושכר"
          action={{
            label: 'צור השכרה ראשונה',
            onClick: () => setIsAddDialogOpen(true),
          }}
          iconColor="primary"
        />
      ) : filteredRentals.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="לא נמצאו השכרות"
          description="נסה לשנות את מסנני החיפוש"
          iconColor="muted"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRentals.map((rental, index) => (
            <div
              key={rental.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E5E7EB',
                borderTop: `3px solid ${rental.status === 'active' ? '#0D9488' : rental.status === 'overdue' ? '#EF4444' : '#22C55E'}`,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 280,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                animationDelay: `${index * 50}ms`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}
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

              {/* Customer + Item Count */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-md shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-foreground truncate">{rental.customerName}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{rental.items.length} פריטים</span>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Calendar className="h-4 w-4" />
                <span>{format(parseISO(rental.startDate), 'dd/MM/yyyy', { locale: he })} - {format(parseISO(rental.endDate), 'dd/MM/yyyy', { locale: he })}</span>
              </div>

              {/* Pickup Time - only for devices and modems */}
              {rental.pickupTime && rental.items.some(item => 
                item.itemCategory === 'device_simple' || 
                item.itemCategory === 'device_smartphone' || 
                item.itemCategory === 'modem'
              ) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-1.5 border border-amber-200/50 dark:border-amber-800/50">
                  <span className="text-amber-600 dark:text-amber-400">🕐</span>
                  <span className="text-amber-700 dark:text-amber-300 font-medium">
                    שעת קבלה: {rental.pickupTime.slice(0, 5)}
                  </span>
                </div>
              )}

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
                  <DualCurrencyPrice amount={rental.totalPrice} currency={rental.currency} />
                </p>
              </div>

              {/* Phone Numbers Display & Download Instructions for SIM cards (European or American) */}
              {(() => {
                // Get all SIM items (European or American) that have inventory IDs
                const simItems = rental.items.filter(
                  item => (item.itemCategory === 'sim_european' || item.itemCategory === 'sim_american') && 
                          !item.isGeneric && 
                          item.inventoryItemId
                );
                
                if (simItems.length === 0) return null;
                
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
                    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                  } else if (cleaned.length >= 11 && cleaned.startsWith('44')) {
                    return `+44-${cleaned.slice(2)}`;
                  } else if (cleaned.length >= 11 && cleaned.startsWith('1')) {
                    return `+1-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
                  } else if (cleaned.length === 9) {
                    return `0${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
                  }
                  return num;
                };
                
                return (
                  <div className="mb-3 space-y-3">
                    {simItems.map((simItem, idx) => {
                      const inventoryItem = inventory.find(i => i.id === simItem.inventoryItemId);
                      const itemId = `rental-${rental.id}-sim-${idx}`;
                      const isEuropeanSim = simItem.itemCategory === 'sim_european';
                      const isAmericanSim = simItem.itemCategory === 'sim_american';
                      
                      return (
                        <div key={idx} className="space-y-2">
                          {/* SIM Label when multiple SIMs */}
                          {simItems.length > 1 && (
                            <p className="text-xs font-medium text-muted-foreground">
                              {isAmericanSim ? '🇺🇸' : '🇪🇺'} {simItem.itemName}
                            </p>
                          )}
                          
                          {/* Phone Numbers Display */}
                          <div className={`bg-gradient-to-r ${isAmericanSim ? 'from-red-50 to-blue-50 dark:from-red-950/30 dark:to-blue-950/30 border-red-200/50 dark:border-red-800/50' : 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200/50 dark:border-blue-800/50'} rounded-lg p-3 border`}>
                            <div className="text-center space-y-1">
                              {inventoryItem?.israeliNumber && (
                                <div className="flex items-center justify-center gap-2 text-sm">
                                  <span className="text-muted-foreground">🇮🇱 ישראלי:</span>
                                  <span className="font-bold text-primary" dir="ltr">
                                    {formatDisplayNumber(inventoryItem?.israeliNumber)}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <span className="text-muted-foreground">{isAmericanSim ? '🇺🇸' : '🌍'} {isAmericanSim ? 'אמריקאי:' : 'מקומי:'}</span>
                                <span className="font-bold text-primary" dir="ltr">
                                  {formatDisplayNumber(inventoryItem?.localNumber)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Download Button - For European and American SIMs */}
                          {(isEuropeanSim || isAmericanSim) && (
                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                              disabled={downloadingInstructions === itemId}
                              onClick={async () => {
                                let israeliNumber = inventoryItem?.israeliNumber;
                                let localNumber = inventoryItem?.localNumber;
                                let barcode = inventoryItem?.barcode;
                                let expiryDate = inventoryItem?.expiryDate;
                                let simNumber = inventoryItem?.simNumber;
                                let packageName: string | undefined;
                                
                                if (!inventoryItem && simItem.inventoryItemId) {
                                  const { data } = await supabase
                                    .from('inventory')
                                    .select('israeli_number, local_number, barcode, expiry_date, name, sim_number')
                                    .eq('id', simItem.inventoryItemId)
                                    .maybeSingle();
                                  if (data) {
                                    israeliNumber = data.israeli_number || undefined;
                                    localNumber = data.local_number || undefined;
                                    barcode = data.barcode || undefined;
                                    expiryDate = data.expiry_date || undefined;
                                    packageName = data.name || undefined;
                                    simNumber = data.sim_number || undefined;
                                  }
                                } else if (inventoryItem) {
                                  packageName = inventoryItem.name;
                                }
                                
                                // Format expiry date for display
                                const formattedExpiry = expiryDate 
                                  ? new Date(expiryDate).toLocaleDateString('he-IL')
                                  : undefined;
                                
                                handlePrintInstructions(
                                  itemId, 
                                  israeliNumber || undefined, 
                                  localNumber || undefined, 
                                  barcode || undefined, 
                                  isAmericanSim,
                                  packageName,
                                  formattedExpiry,
                                  simNumber
                                );
                              }}
                                className="gap-1 text-xs w-full"
                              >
                                {downloadingInstructions === itemId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Printer className="h-3 w-3" />
                                )}
                                הדפס הוראות חיוג{simItems.length > 1 ? ` - ${simItem.itemName}` : ''}
                              </Button>
                            </div>
                          )}



                          
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Actions - Always visible for active/overdue */}
              {(rental.status === 'active' || rental.status === 'overdue') && (
                <div className="space-y-2 mt-auto pt-3 border-t border-border">
                  <div className="flex justify-center gap-2">
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
                    <div className="flex items-center">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => notifyRentalCustomer(rental)}
                        disabled={callingRentalId === rental.id}
                        className="rounded-l-none border-r-0"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <CallHistoryBadge 
                        entityType="rental" 
                        entityId={rental.id}
                        className="rounded-r-none border border-input bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => openExtendDialog(rental)}
                      className="flex-1"
                    >
                      <CalendarPlus className="h-4 w-4 ml-1" />
                      הארכה
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleReturn(rental.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Rental Dialog */}
      <EditRentalDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        rental={editingRental}
      />

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>תשלום עבור השכרה</DialogTitle>
            <DialogDescription>הזן פרטי כרטיס אשראי לביצוע התשלום</DialogDescription>
          </DialogHeader>
          {paymentRental && (() => {
            const customer = getPaymentCustomer();
            const hasStoredToken = customer?.hasPaymentToken;
            
            return (
            <div className="space-y-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="font-medium">{paymentRental.customerName}</p>
                <p className="text-2xl font-bold text-primary">
                  <DualCurrencyPrice amount={paymentRental.totalPrice} currency={paymentRental.currency} />
                </p>
              </div>

              {/* Payment method tabs */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    !isTerminalMode 
                      ? 'bg-background shadow text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setIsTerminalMode(false)}
                >
                  <CreditCard className="h-4 w-4" />
                  הקלדה ידנית
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    isTerminalMode 
                      ? 'bg-background shadow text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setIsTerminalMode(true)}
                >
                  <Wifi className="h-4 w-4" />
                  שידור למסוף
                </button>
              </div>

              {/* Terminal mode */}
              {isTerminalMode ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-center">
                    {terminalStatus === 'waiting' ? (
                      <>
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3 text-primary" />
                        <p className="font-medium text-lg">ממתין לתשלום במסוף...</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          בקש מהלקוח להעביר את הכרטיס במסוף
                        </p>
                      </>
                    ) : (
                      <>
                        <Wifi className="h-12 w-12 mx-auto mb-3 text-primary" />
                        <p className="font-medium text-lg">שידור למסוף פלאכארד</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          לחץ על הכפתור לשידור העסקה למסוף הפיזי
                        </p>
                      </>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleTerminalPayment}
                    className="w-full"
                    disabled={terminalStatus === 'waiting' || payingRentalId === paymentRental.id}
                    variant="glow"
                  >
                    {terminalStatus === 'waiting' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ממתין למסוף...
                      </>
                    ) : (
                      <>
                        <Wifi className="h-4 w-4 mr-2" />
                        שדר למסוף
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
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

                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label>תוקף (MMYY)</Label>
                          <Input
                            value={paymentFormData.creditCardExpiry}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, creditCardExpiry: e.target.value })}
                            placeholder="0126"
                            maxLength={4}
                            dir="ltr"
                            className="min-h-[44px]"
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
                            className="min-h-[44px]"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {!isTerminalMode && (
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handlePaymentClick} 
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
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog (for saved card payments) */}
      {paymentRental && (() => {
        const customer = getPaymentCustomer();
        return (
          <PaymentConfirmationDialog
            isOpen={isPaymentConfirmOpen}
            onOpenChange={setIsPaymentConfirmOpen}
            originalAmount={paymentRental.totalPrice}
            currency={paymentRental.currency}
            customerName={paymentRental.customerName}
            cardLast4={customer?.paymentTokenLast4}
            cardExpiry={customer?.paymentTokenExpiry}
            onConfirm={handlePayment}
            isProcessing={payingRentalId === paymentRental.id}
          />
        );
      })()}

      {/* Extend Rental Dialog */}
      <Dialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              הארכת השכרה
            </DialogTitle>
            <DialogDescription>
              {extendingRental && `הארכת השכרה של ${extendingRental.customerName}`}
            </DialogDescription>
          </DialogHeader>
          
          {extendingRental && (
            <div className="space-y-4">
              {/* Current end date */}
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">תאריך החזרה נוכחי</p>
                <p className="text-lg font-bold">
                  {format(parseISO(extendingRental.endDate), 'dd/MM/yyyy', { locale: he })}
                </p>
              </div>
              
              {/* Date picker for new end date */}
              <div className="space-y-2">
                <p className="text-sm font-medium">בחר תאריך החזרה חדש:</p>
                <Input
                  type="date"
                  value={extendNewEndDate ? format(extendNewEndDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setExtendNewEndDate(new Date(e.target.value));
                    }
                  }}
                  min={format(addDays(parseISO(extendingRental.endDate), 1), 'yyyy-MM-dd')}
                  className="w-full text-center text-lg min-h-[44px]"
                />
              </div>
              
              {/* Quick extend buttons */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">או הארך ב:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[3, 7, 14, 30].map(days => (
                    <Button
                      key={days}
                      variant="outline"
                      size="sm"
                      onClick={() => setExtendNewEndDate(addDays(parseISO(extendingRental.endDate), days))}
                      className="flex-col h-auto py-3 sm:py-2 min-h-[44px]"
                    >
                      <span className="text-sm font-bold">+{days}</span>
                      <span className="text-xs">ימים</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* New end date preview */}
              {extendNewEndDate && (
                <div className="p-3 rounded-lg bg-primary/10 text-center border border-primary/20">
                  <p className="text-sm text-muted-foreground">תאריך החזרה חדש</p>
                  <p className="text-lg font-bold text-primary">
                    {format(extendNewEndDate, 'dd/MM/yyyy', { locale: he })}
                  </p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleExtendRental} 
                  className="flex-1"
                  disabled={isExtending || !extendNewEndDate}
                >
                  {isExtending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      מאריך...
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="h-4 w-4 ml-2" />
                      הארך השכרה
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setExtendDialogOpen(false)}
                  disabled={isExtending}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>




    </div>
  );
}

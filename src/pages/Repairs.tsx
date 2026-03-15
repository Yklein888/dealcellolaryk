import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { CallHistoryBadge } from '@/components/CallHistoryBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
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
  Wrench,
  CheckCircle,
  Package,
  Printer,
  Download,
  Trash2,
  Shield,
  Phone,
  RotateCcw
} from 'lucide-react';
import { Repair, repairStatusLabels } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { he } from 'date-fns/locale';

// deviceTypes removed - using deviceModel input only

export default function Repairs() {
  const { repairs, addRepair, updateRepair, deleteRepair, loading } = useRental();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [warrantyFilter, setWarrantyFilter] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [callingRepairId, setCallingRepairId] = useState<string | null>(null);

  // Read URL params on mount
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
      // Clear the URL param after applying
      setSearchParams({}, { replace: true });
    }
  }, []);

  const notifyCustomer = async (repair: Repair) => {
    if (!repair.customerPhone) {
      toast({
        title: 'שגיאה',
        description: 'אין מספר טלפון ללקוח זה',
        variant: 'destructive',
      });
      return;
    }

    setCallingRepairId(repair.id);

    try {
      const message = `שלום ${repair.customerName}, המכשיר שלך מספר ${repair.repairNumber} מוכן לאיסוף. תודה רבה.`;
      
      const response = await fetch(
        `/api/yemot-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: repair.customerPhone,
            message,
            entityType: 'repair',
            entityId: repair.id,
            callType: 'manual',
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'ההודעה נשלחה',
          description: `שיחה יוצאת ל-${repair.customerPhone}`,
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
      setCallingRepairId(null);
    }
  };

  // Calculate next repair number automatically
  const nextRepairNumber = useMemo(() => {
    if (repairs.length === 0) return '1';
    const maxNumber = Math.max(...repairs.map(r => {
      const num = parseInt(r.repairNumber, 10);
      return isNaN(num) ? 0 : num;
    }));
    return String(maxNumber + 1);
  }, [repairs]);

  const [formData, setFormData] = useState({
    repairNumber: '',
    deviceType: '',
    deviceModel: '',
    deviceCost: '',
    customerName: '',
    customerPhone: '',
    problemDescription: '',
    notes: '',
    status: 'in_lab' as Repair['status'],
    isWarranty: false,
  });

  // Update repair number when dialog opens
  useEffect(() => {
    if (isAddDialogOpen) {
      setFormData(prev => ({ ...prev, repairNumber: nextRepairNumber }));
    }
  }, [isAddDialogOpen, nextRepairNumber]);

  const filteredRepairs = repairs.filter(repair => {
    const matchesSearch =
      repair.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.customerPhone.includes(searchTerm) ||
      repair.deviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repair.repairNumber.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' || repair.status === filterStatus;

    // Time filter - use most relevant date per repair
    let matchesTime = true;
    if (timeFilter !== 'all') {
      const relevantDate = repair.completedDate || repair.collectedDate || repair.receivedDate;
      const date = parseISO(relevantDate);
      if (timeFilter === 'today') matchesTime = isToday(date);
      else if (timeFilter === 'week') matchesTime = isThisWeek(date, { weekStartsOn: 0 });
      else if (timeFilter === 'month') matchesTime = isThisMonth(date);
    }

    const matchesWarranty = !warrantyFilter || repair.isWarranty;

    return matchesSearch && matchesStatus && matchesTime && matchesWarranty;
  });

  // Get repairs marked as ready today
  const todayReadyRepairs = useMemo(() => {
    return repairs.filter(repair => 
      repair.status === 'ready' && 
      repair.completedDate && 
      isToday(parseISO(repair.completedDate))
    );
  }, [repairs]);

  const exportTodayReadyPhones = () => {
    if (todayReadyRepairs.length === 0) {
      toast({
        title: 'אין תיקונים מוכנים היום',
        description: 'לא נמצאו תיקונים שסומנו כמוכנים היום',
        variant: 'destructive',
      });
      return;
    }

    const phones = todayReadyRepairs
      .map(r => `${r.customerName}: ${r.customerPhone}`)
      .join('\n');
    
    const blob = new Blob([phones], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ready-repairs-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'הקובץ הורד בהצלחה',
      description: `${todayReadyRepairs.length} מספרי טלפון יוצאו`,
    });
  };

  const resetForm = () => {
    setFormData({
      repairNumber: '',
      deviceType: '',
      deviceModel: '',
      deviceCost: '',
      customerName: '',
      customerPhone: '',
      problemDescription: '',
      notes: '',
      status: 'in_lab',
      isWarranty: false,
    });
  };

  const handleSubmit = () => {
    if (!formData.repairNumber || !formData.deviceModel || !formData.customerName || !formData.problemDescription) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא מספר תיקון, דגם מכשיר, שם לקוח ותיאור הבעיה',
        variant: 'destructive',
      });
      return;
    }

    const newRepairData = {
      repairNumber: formData.repairNumber,
      deviceType: formData.deviceModel, // Use deviceModel as deviceType for DB compatibility
      deviceModel: formData.deviceModel,
      deviceCost: formData.deviceCost ? parseFloat(formData.deviceCost) : undefined,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      problemDescription: formData.problemDescription,
      notes: formData.notes || undefined,
      status: formData.status,
      isWarranty: formData.isWarranty,
      receivedDate: new Date().toISOString().split('T')[0],
    };

    addRepair(newRepairData);

    toast({
      title: 'תיקון נוסף',
      description: 'התיקון נוסף למערכת בהצלחה',
    });

    // Print the repair form
    printRepairForm(newRepairData);

    resetForm();
    setIsAddDialogOpen(false);
  };

  const printRepairForm = (repair: { repairNumber: string; deviceType: string; deviceModel?: string; deviceCost?: number; customerName: string; customerPhone: string; problemDescription: string; notes?: string; status: string; isWarranty?: boolean; receivedDate: string }) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>טופס תיקון ${repair.repairNumber}</title>
        <style>
          @page { 
            size: A6; 
            margin: 3mm; 
          }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            padding: 3mm; 
            direction: rtl; 
            margin: 0;
            width: 105mm;
            height: 148mm;
            font-size: 9pt;
          }
          .repair-number-huge { 
            font-size: 48pt; 
            font-weight: 900; 
            color: #0d9488; 
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            direction: ltr;
            padding: 0;
            margin: 0 0 2mm 0;
            border: none;
            background: none;
            line-height: 1;
          }
          .warranty-badge {
            display: inline-block;
            background: #22c55e;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 8pt;
            margin-inline-start: 6px;
          }
          .title {
            font-size: 11pt;
            color: #333;
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            margin-bottom: 4mm;
          }
          .field { 
            margin-bottom: 2mm; 
            padding: 2mm; 
            background: #f5f5f5; 
            border-radius: 4px; 
            text-align: center;
          }
          .label { 
            font-weight: bold; 
            color: #555; 
            font-size: 8pt; 
            text-align: center;
          }
          .value { 
            font-size: 9pt; 
            color: #333; 
            text-align: center;
          }
          .footer { margin-top: 3mm; text-align: center; color: #888; font-size: 7pt; }
          @media print {
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="repair-number-huge">${repair.repairNumber}</div>
        <div class="title">טופס קבלת מכשיר לתיקון ${repair.isWarranty ? '<span class="warranty-badge">באחריות</span>' : ''}</div>
        
        <div class="field">
          <div class="label">דגם המכשיר | תיאור הבעיה:</div>
          <div class="value">${repair.deviceModel || repair.deviceType} | ${repair.problemDescription}</div>
        </div>

        ${repair.deviceCost ? `
        <div class="field">
          <div class="label">עלות התיקון:</div>
          <div class="value">₪${repair.deviceCost}</div>
        </div>
        ` : ''}
        
        <div class="field">
          <div class="label">שם הלקוח:</div>
          <div class="value">${repair.customerName}</div>
        </div>
        
        <div class="field">
          <div class="label">טלפון:</div>
          <div class="value">${repair.customerPhone || 'לא צוין'}</div>
        </div>
        
        ${repair.notes ? `
        <div class="field">
          <div class="label">הערות:</div>
          <div class="value">${repair.notes}</div>
        </div>
        ` : ''}
        
        <div class="field">
          <div class="label">תאריך קבלה:</div>
          <div class="value">${new Date(repair.receivedDate).toLocaleDateString('he-IL')}</div>
        </div>
        
        <div class="footer">דיל סלולר | מסמך זה הופק אוטומטית</div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintExistingRepair = (repair: Repair) => {
    printRepairForm({
      repairNumber: repair.repairNumber,
      deviceType: repair.deviceType,
      customerName: repair.customerName,
      customerPhone: repair.customerPhone,
      problemDescription: repair.problemDescription,
      notes: repair.notes || '',
      status: repair.status,
      receivedDate: repair.receivedDate,
    });
  };

  const handleStatusChange = (repairId: string, newStatus: Repair['status']) => {
    const updates: Partial<Repair> = { status: newStatus };
    
    if (newStatus === 'ready') {
      updates.completedDate = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'collected') {
      updates.collectedDate = new Date().toISOString().split('T')[0];
    }

    updateRepair(repairId, updates);
    toast({
      title: 'סטטוס עודכן',
      description: `הסטטוס שונה ל-${repairStatusLabels[newStatus]}`,
    });
  };

  const handleDeleteRepair = (repairId: string, repairNumber: string) => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את תיקון ${repairNumber}?`)) {
      deleteRepair(repairId);
      toast({
        title: 'תיקון נמחק',
        description: `תיקון ${repairNumber} נמחק מהמערכת`,
      });
    }
  };

  const getStatusVariant = (status: Repair['status']) => {
    switch (status) {
      case 'in_lab': return 'warning';
      case 'ready': return 'success';
      case 'collected': return 'default';
      default: return 'default';
    }
  };

  if (loading) return <PageLoadingSkeleton columns={1} rows={4} showFilterBar={true} />;

  return (
    <div>
      <PageHeader 
        title="מעבדת תיקונים" 
        description="ניהול מכשירים שנכנסו לתיקון"
      >
        <div className="flex flex-col sm:flex-row gap-2">
          {todayReadyRepairs.length > 0 && (
            <Button variant="outline" onClick={exportTodayReadyPhones}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">ייצא טלפונים מוכנים היום</span>
              <span className="sm:hidden">ייצא ({todayReadyRepairs.length})</span>
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="glow" size="lg">
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">הוסף תיקון</span>
                <span className="sm:hidden">הוסף</span>
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוספת תיקון חדש</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3 mt-4">
              {/* Row 1: Customer Name + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>שם הלקוח *</Label>
                  <Input
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="שם מלא"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label>טלפון</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    placeholder="050-1234567"
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {/* Row 2: Device Model + Device Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>דגם המכשיר *</Label>
                  <Input
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    placeholder="לדוגמה: iPhone 14"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label>עלות התיקון (₪)</Label>
                  <Input
                    type="number"
                    value={formData.deviceCost}
                    onChange={(e) => setFormData({ ...formData, deviceCost: e.target.value })}
                    className="min-h-[44px]"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Row 3: Repair Number + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>מספר תיקון *</Label>
                  <Input
                    value={formData.repairNumber}
                    onChange={(e) => setFormData({ ...formData, repairNumber: e.target.value })}
                    placeholder="לדוגמה: 1"
                  />
                </div>
                <div className="space-y-1">
                  <Label>סטטוס</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value as Repair['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_lab">במעבדה</SelectItem>
                      <SelectItem value="ready">מוכן</SelectItem>
                      <SelectItem value="collected">נאסף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: Problem Description (full width) */}
              <div className="space-y-1">
                <Label>תיאור הבעיה *</Label>
                <Textarea
                  value={formData.problemDescription}
                  onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                  placeholder="תאר את הבעיה..."
                  rows={2}
                  className="min-h-[60px]"
                />
              </div>

              {/* Row 5: Notes + Warranty */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>הערות</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="הערות נוספות..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>באחריות</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={formData.isWarranty}
                      onCheckedChange={(checked) => setFormData({ ...formData, isWarranty: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.isWarranty ? 'כן' : 'לא'}
                    </span>
                    {formData.isWarranty && <Shield className="h-4 w-4 text-success" />}
                  </div>
                </div>
              </div>

              {/* Row 6: Buttons */}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSubmit} className="flex-1">
                  הוסף תיקון
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
        </div>
      </PageHeader>

      {/* Status Stats - Quick Access */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {([
          { status: 'in_lab',    label: 'במעבדה', Icon: Wrench,       bg: '#FFFBEB', iconBg: '#F59E0B', text: '#92400E', border: '#FDE68A' },
          { status: 'ready',     label: 'מוכנים',  Icon: CheckCircle,  bg: '#F0FDF4', iconBg: '#22C55E', text: '#15803D', border: '#BBF7D0' },
          { status: 'collected', label: 'נאספו',   Icon: Package,      bg: '#F8FAFC', iconBg: '#64748B', text: '#1E293B', border: '#E2E8F0' },
        ] as const).map(({ status, label, Icon, bg, iconBg, text, border }) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            style={{
              background: filterStatus === status ? bg : '#FFFFFF',
              border: `1px solid ${filterStatus === status ? border : '#F3F4F6'}`,
              borderRadius: 16,
              padding: '20px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 20px ${iconBg}30`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ background: iconBg, borderRadius: 10, padding: 10, display: 'inline-flex', boxShadow: `0 4px 12px ${iconBg}40` }}>
                <Icon style={{ width: 20, height: 20, color: 'white' }} />
              </div>
              <span style={{ fontSize: 32, fontWeight: 800, color: text, lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
                {repairs.filter(r => r.status === status).length}
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Time & Special Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
        {([
          { value: 'all',     label: 'הכל',      icon: '📋' },
          { value: 'today',   label: 'היום',      icon: '📅' },
          { value: 'week',    label: 'השבוע',     icon: '📆' },
          { value: 'month',   label: 'החודש',     icon: '🗓️' },
        ] as const).map(({ value, label, icon }) => {
          const isActive = timeFilter === value;
          return (
            <button
              key={value}
              onClick={() => setTimeFilter(timeFilter === value && value !== 'all' ? 'all' : value)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1.5px solid ${isActive ? '#0D9488' : '#E5E7EB'}`,
                background: isActive ? '#F0FDFA' : '#FFFFFF',
                color: isActive ? '#0D9488' : '#6B7280',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setWarrantyFilter(!warrantyFilter)}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: `1.5px solid ${warrantyFilter ? '#22C55E' : '#E5E7EB'}`,
            background: warrantyFilter ? '#F0FDF4' : '#FFFFFF',
            color: warrantyFilter ? '#15803D' : '#6B7280',
            fontWeight: warrantyFilter ? 700 : 500,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Shield style={{ width: 14, height: 14 }} />
          <span>באחריות</span>
        </button>
      </div>

      {/* Search & Status Filter */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 16px', marginBottom: 24, border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון או סוג מכשיר..."
            className="pr-10 h-10 rounded-lg border-gray-200 focus-visible:ring-1 focus-visible:ring-teal-400"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-44 h-10 rounded-lg border-gray-200">
            <SelectValue placeholder="כל הסטטוסים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="in_lab">במעבדה</SelectItem>
            <SelectItem value="ready">מוכן</SelectItem>
            <SelectItem value="collected">נאסף</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Repairs List */}
      {filteredRepairs.length === 0 ? (
        repairs.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="אין תיקונים עדיין"
            description="קבל מכשיר לתיקון ועקוב אחרי הסטטוס שלו בקלות"
            action={{
              label: 'הוסף תיקון ראשון',
              onClick: () => setIsAddDialogOpen(true),
            }}
            iconColor="primary"
          />
        ) : (
          <EmptyState
            icon={Wrench}
            title="לא נמצאו תיקונים"
            description="נסה לשנות את מילות החיפוש"
            iconColor="muted"
          />
        )
      ) : (
        <div className="space-y-4">
          {filteredRepairs.map((repair) => (
            <div
              key={repair.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #F3F4F6',
                borderTop: `3px solid ${repair.status === 'in_lab' ? '#F59E0B' : repair.status === 'ready' ? '#22C55E' : '#94A3B8'}`,
                padding: '20px',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = '';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '';
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Prominent Repair Number Badge */}
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: 'linear-gradient(135deg,#0D9488,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 22, boxShadow: '0 4px 14px rgba(13,148,136,0.35)', flexShrink: 0 }}>
                    {repair.repairNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-foreground text-lg">{repair.customerName}</p>
                      <StatusBadge 
                        status={repairStatusLabels[repair.status]} 
                        variant={getStatusVariant(repair.status)} 
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">{repair.deviceModel || repair.deviceType}</p>
                    <p className="text-muted-foreground text-sm mt-1">{repair.customerPhone}</p>
                    <p className="text-sm text-muted-foreground mt-1">{repair.problemDescription}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <span>התקבל: {format(parseISO(repair.receivedDate), 'dd/MM/yyyy', { locale: he })}</span>
                      {repair.completedDate && <span>• הושלם: {format(parseISO(repair.completedDate), 'dd/MM/yyyy', { locale: he })}</span>}
                      {repair.deviceCost && <span>• עלות: ₪{repair.deviceCost}</span>}
                      {repair.isWarranty && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Shield className="h-3 w-3" />
                          באחריות
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-row sm:flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePrintExistingRepair(repair)}
                  >
                    <Printer className="h-4 w-4" />
                    הדפס
                  </Button>
                  {repair.status === 'in_lab' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleStatusChange(repair.id, 'ready')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      סמן כמוכן
                    </Button>
                  )}
                  {repair.status === 'ready' && (
                    <>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => notifyCustomer(repair)}
                          disabled={callingRepairId === repair.id}
                        >
                          <Phone className="h-4 w-4" />
                          {callingRepairId === repair.id ? 'מתקשר...' : 'הודע ללקוח'}
                        </Button>
                        <CallHistoryBadge
                          entityType="repair"
                          entityId={repair.id}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(repair.id, 'collected')}
                      >
                        <Package className="h-4 w-4" />
                        נאסף
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(repair.id, 'in_lab')}
                      >
                        <RotateCcw className="h-4 w-4" />
                        חזור לעבודה
                      </Button>
                    </>
                  )}
                  {repair.status === 'collected' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(repair.id, 'ready')}
                    >
                      <RotateCcw className="h-4 w-4" />
                      חזור למוכן
                    </Button>
                  )}
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteRepair(repair.id, repair.repairNumber)}
                  >
                    <Trash2 className="h-4 w-4" />
                    מחק
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

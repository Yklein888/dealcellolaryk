import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
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
  Phone
} from 'lucide-react';
import { Repair, repairStatusLabels } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isToday } from 'date-fns';
import { he } from 'date-fns/locale';

// deviceTypes removed - using deviceModel input only

export default function Repairs() {
  const { repairs, addRepair, updateRepair, deleteRepair } = useRental();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yemot-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
    return matchesSearch && matchesStatus;
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

  return (
    <div className="animate-fade-in">
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setFilterStatus('in_lab')}
          className={`stat-card p-4 text-center transition-all hover:border-warning/50 cursor-pointer ${filterStatus === 'in_lab' ? 'border-warning bg-warning/10' : ''}`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Wrench className="h-5 w-5 text-warning" />
            <span className="text-2xl font-bold text-warning">
              {repairs.filter(r => r.status === 'in_lab').length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">במעבדה</p>
        </button>
        
        <button
          onClick={() => setFilterStatus('ready')}
          className={`stat-card p-4 text-center transition-all hover:border-success/50 cursor-pointer ${filterStatus === 'ready' ? 'border-success bg-success/10' : ''}`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-success">
              {repairs.filter(r => r.status === 'ready').length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">מוכנים</p>
        </button>
        
        <button
          onClick={() => setFilterStatus('collected')}
          className={`stat-card p-4 text-center transition-all hover:border-muted-foreground/50 cursor-pointer ${filterStatus === 'collected' ? 'border-muted-foreground bg-muted' : ''}`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-muted-foreground">
              {repairs.filter(r => r.status === 'collected').length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">נאספו</p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="חיפוש לפי שם, טלפון או סוג מכשיר..."
            className="pr-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-48">
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
        <div className="stat-card text-center py-12">
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">אין תיקונים</p>
          <p className="text-muted-foreground">הוסף תיקונים חדשים כדי להתחיל</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRepairs.map((repair, index) => (
            <div 
              key={repair.id}
              className="stat-card hover:border-primary/30 transition-all duration-200 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Prominent Repair Number Badge */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-lg">
                      {repair.repairNumber}
                    </div>
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

                <div className="flex gap-2 md:flex-col">
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
                    </>
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

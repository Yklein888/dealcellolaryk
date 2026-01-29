import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
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

const deviceTypes = [
  'סמארטפון',
  'מכשיר פשוט',
  'מודם',
  'נטסטיק',
  'אחר',
];

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
    if (!formData.repairNumber || !formData.deviceType || !formData.customerName || !formData.problemDescription) {
      toast({
        title: 'שגיאה',
        description: 'יש למלא מספר תיקון, סוג מכשיר, שם לקוח ותיאור הבעיה',
        variant: 'destructive',
      });
      return;
    }

    const newRepairData = {
      repairNumber: formData.repairNumber,
      deviceType: formData.deviceType,
      deviceModel: formData.deviceModel || undefined,
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
            font-size: 72pt; 
            font-weight: 900; 
            color: #0d9488; 
            text-align: center; 
            padding: 8mm 5mm;
            margin: 0 auto 5mm auto;
            border: 3px solid #0d9488;
            border-radius: 10px;
            background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
            text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .warranty-badge {
            display: inline-block;
            background: #22c55e;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 8pt;
            margin-right: 5px;
          }
          .title { font-size: 11pt; color: #333; text-align: center; margin-bottom: 4mm; }
          .field { margin-bottom: 2mm; padding: 2mm; background: #f5f5f5; border-radius: 4px; }
          .label { font-weight: bold; color: #555; font-size: 8pt; }
          .value { font-size: 9pt; color: #333; }
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
          <div class="label">סוג המכשיר:</div>
          <div class="value">${repair.deviceType}${repair.deviceModel ? ` - ${repair.deviceModel}` : ''}</div>
        </div>

        ${repair.deviceCost ? `
        <div class="field">
          <div class="label">עלות המכשיר:</div>
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
        
        <div class="field">
          <div class="label">תיאור הבעיה:</div>
          <div class="value">${repair.problemDescription}</div>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>הוספת תיקון חדש</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>מספר תיקון *</Label>
                  <Input
                    value={formData.repairNumber}
                    onChange={(e) => setFormData({ ...formData, repairNumber: e.target.value })}
                    placeholder="לדוגמה: 1"
                  />
                </div>

                <div className="space-y-2">
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

              <div className="space-y-2">
                <Label>שם הלקוח *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="שם מלא"
                />
              </div>

              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="050-1234567"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>סוג המכשיר *</Label>
                  <Select 
                    value={formData.deviceType} 
                    onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג מכשיר" />
                    </SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>דגם המכשיר</Label>
                  <Input
                    value={formData.deviceModel}
                    onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                    placeholder="לדוגמה: iPhone 14"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>עלות המכשיר (₪)</Label>
                  <Input
                    type="number"
                    value={formData.deviceCost}
                    onChange={(e) => setFormData({ ...formData, deviceCost: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>באחריות</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={formData.isWarranty}
                      onCheckedChange={(checked) => setFormData({ ...formData, isWarranty: checked })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.isWarranty ? 'כן, באחריות' : 'לא באחריות'}
                    </span>
                    {formData.isWarranty && <Shield className="h-4 w-4 text-success" />}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>תיאור הבעיה *</Label>
                <Textarea
                  value={formData.problemDescription}
                  onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                  placeholder="תאר את הבעיה..."
                  rows={3}
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
                      <p className="font-semibold text-foreground text-lg">{repair.deviceType}</p>
                      <StatusBadge 
                        status={repairStatusLabels[repair.status]} 
                        variant={getStatusVariant(repair.status)} 
                      />
                    </div>
                    <p className="text-muted-foreground">{repair.customerName} • {repair.customerPhone}</p>
                    {repair.deviceModel && (
                      <p className="text-sm text-muted-foreground">דגם: {repair.deviceModel}</p>
                    )}
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
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => notifyCustomer(repair)}
                        disabled={callingRepairId === repair.id}
                      >
                        <Phone className="h-4 w-4" />
                        {callingRepairId === repair.id ? 'מתקשר...' : 'הודע ללקוח'}
                      </Button>
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

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2 } from 'lucide-react';
import { ItemCategory, categoryLabels } from '@/types/rental';
import { useToast } from '@/hooks/use-toast';
import { useRental } from '@/hooks/useRental';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ColumnMapping {
  name: string;
  localNumber: string;
  israeliNumber: string;
  expiryDate: string;
}

interface ParsedRow {
  name?: string;
  localNumber?: string;
  israeliNumber?: string;
  expiryDate?: string;
}

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const { addInventoryItem } = useRental();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [category, setCategory] = useState<ItemCategory>('sim_european');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: '',
    localNumber: '',
    israeliNumber: '',
    expiryDate: '',
  });
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setData([]);
    setCategory('sim_european');
    setColumnMapping({
      name: '',
      localNumber: '',
      israeliNumber: '',
      expiryDate: '',
    });
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { 
        header: 1,
        raw: false,
        defval: ''
      });

      if (jsonData.length < 2) {
        toast({
          title: 'שגיאה',
          description: 'הקובץ ריק או אין בו מספיק שורות',
          variant: 'destructive',
        });
        return;
      }

      // First row is headers
      const headerRow = jsonData[0] as unknown as string[];
      const dataRows = jsonData.slice(1).map(row => {
        const rowArray = row as unknown as string[];
        const obj: Record<string, string> = {};
        headerRow.forEach((header, index) => {
          obj[header] = rowArray[index] || '';
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v)); // Filter empty rows

      setHeaders(headerRow);
      setData(dataRows);

      // Auto-detect column mappings
      const autoMapping: ColumnMapping = {
        name: '',
        localNumber: '',
        israeliNumber: '',
        expiryDate: '',
      };

      headerRow.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('שם') || lowerHeader.includes('name')) {
          autoMapping.name = header;
        } else if (lowerHeader.includes('מקומי') || lowerHeader.includes('local')) {
          autoMapping.localNumber = header;
        } else if (lowerHeader.includes('ישראל') || lowerHeader.includes('israeli')) {
          autoMapping.israeliNumber = header;
        } else if (lowerHeader.includes('תוקף') || lowerHeader.includes('expir') || lowerHeader.includes('date')) {
          autoMapping.expiryDate = header;
        }
      });

      setColumnMapping(autoMapping);
      setStep('mapping');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'שגיאה בקריאת הקובץ',
        description: 'וודא שהקובץ הוא Excel או CSV תקין',
        variant: 'destructive',
      });
    }
  };

  const getMappedData = (): ParsedRow[] => {
    return data.map(row => ({
      name: columnMapping.name ? row[columnMapping.name] : undefined,
      localNumber: columnMapping.localNumber ? row[columnMapping.localNumber] : undefined,
      israeliNumber: columnMapping.israeliNumber ? row[columnMapping.israeliNumber] : undefined,
      expiryDate: columnMapping.expiryDate ? formatDate(row[columnMapping.expiryDate]) : undefined,
    }));
  };

  const formatDate = (dateStr: string): string | undefined => {
    if (!dateStr) return undefined;
    
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Try DD/MM/YYYY format
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
    
    return undefined;
  };

  const handleImport = async () => {
    if (!columnMapping.name) {
      toast({
        title: 'שגיאה',
        description: 'יש לבחור עמודה עבור שם הפריט',
        variant: 'destructive',
      });
      return;
    }

    const mappedData = getMappedData().filter(row => row.name);
    
    if (mappedData.length === 0) {
      toast({
        title: 'שגיאה',
        description: 'אין נתונים לייבוא',
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: mappedData.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < mappedData.length; i++) {
      const row = mappedData[i];
      try {
        await addInventoryItem({
          category,
          name: row.name!,
          localNumber: row.localNumber,
          israeliNumber: row.israeliNumber,
          expiryDate: row.expiryDate,
          status: 'available',
        });
        successCount++;
      } catch (error) {
        console.error('Error importing row:', row, error);
        errorCount++;
      }
      setImportProgress({ current: i + 1, total: mappedData.length });
    }

    toast({
      title: 'הייבוא הושלם',
      description: `יובאו ${successCount} פריטים בהצלחה${errorCount > 0 ? `, ${errorCount} נכשלו` : ''}`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    handleClose();
  };

  const previewData = getMappedData().slice(0, 5);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            ייבוא פריטים מקובץ
          </DialogTitle>
          <DialogDescription>
            העלה קובץ Excel או CSV עם נתוני הסימים
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label>קטגוריה לייבוא</Label>
              <Select value={category} onValueChange={(v: ItemCategory) => setCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div 
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">לחץ להעלאת קובץ</p>
              <p className="text-sm text-muted-foreground mt-1">
                Excel (.xlsx, .xls) או CSV
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">💡 טיפים:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• השורה הראשונה צריכה להכיל כותרות עמודות</li>
                <li>• עמודות מומלצות: שם, מספר מקומי, מספר ישראלי, תוקף</li>
                <li>• ניתן לייצא מ-Google Sheets כ-Excel או CSV</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-6 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              {fileName} • {data.length} שורות
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">מיפוי עמודות</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>שם הפריט *</Label>
                  <Select 
                    value={columnMapping.name} 
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, name: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר עמודה" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>מספר מקומי</Label>
                  <Select 
                    value={columnMapping.localNumber || 'none'} 
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, localNumber: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר עמודה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- לא למפות --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>מספר ישראלי</Label>
                  <Select 
                    value={columnMapping.israeliNumber || 'none'} 
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, israeliNumber: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר עמודה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- לא למפות --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>תוקף</Label>
                  <Select 
                    value={columnMapping.expiryDate || 'none'} 
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, expiryDate: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר עמודה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- לא למפות --</SelectItem>
                      {headers.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {columnMapping.name && previewData.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">תצוגה מקדימה (5 ראשונים)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-right">שם</th>
                        <th className="p-2 text-right">מספר מקומי</th>
                        <th className="p-2 text-right">מספר ישראלי</th>
                        <th className="p-2 text-right">תוקף</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{row.name || '-'}</td>
                          <td className="p-2">{row.localNumber || '-'}</td>
                          <td className="p-2">{row.israeliNumber || '-'}</td>
                          <td className="p-2">{row.expiryDate || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button onClick={handleImport} className="flex-1" disabled={!columnMapping.name}>
                <Check className="h-4 w-4 ml-2" />
                ייבא {data.filter(row => columnMapping.name && row[columnMapping.name]).length} פריטים
              </Button>
              <Button variant="outline" onClick={() => setStep('upload')}>
                חזור
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-6 mt-4 text-center py-8">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="text-lg font-medium">מייבא פריטים...</p>
              <p className="text-muted-foreground mt-1">
                {importProgress.current} / {importProgress.total}
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

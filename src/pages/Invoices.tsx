import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Printer, Download, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ProtectedByPermission } from '@/components/ProtectedByPermission';

interface Invoice {
  id: string;
  invoice_number: number;
  customer_id: string | null;
  customer_name: string;
  rental_id: string | null;
  transaction_id: string | null;
  amount: number;
  currency: string;
  description: string | null;
  business_name: string;
  business_id: string;
  status: string;
  issued_at: string;
  created_at: string;
}

function InvoicesContent() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('issued_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את החשבוניות',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number.toString().includes(searchTerm) ||
      (invoice.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const printInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>חשבונית ${invoice.invoice_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
            padding: 20px; 
            direction: rtl;
            color: #333;
            line-height: 1.6;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #0d9488;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .business-info {
            text-align: right;
          }
          .business-name {
            font-size: 28px;
            font-weight: bold;
            color: #0d9488;
            margin: 0;
          }
          .business-id {
            font-size: 14px;
            color: #666;
            margin: 5px 0 0 0;
          }
          .invoice-info {
            text-align: left;
            background: #f0fdfa;
            padding: 15px 20px;
            border-radius: 10px;
          }
          .invoice-number {
            font-size: 24px;
            font-weight: bold;
            color: #0d9488;
          }
          .invoice-date {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
          }
          .customer-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #0d9488;
            margin: 0 0 10px 0;
          }
          .customer-name {
            font-size: 18px;
            font-weight: 500;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .details-table th {
            background: #0d9488;
            color: white;
            padding: 12px 15px;
            text-align: right;
            font-weight: 500;
          }
          .details-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e5e7eb;
          }
          .details-table tr:nth-child(even) {
            background: #f8f9fa;
          }
          .total-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
          }
          .total-box {
            background: linear-gradient(135deg, #0d9488, #14b8a6);
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            text-align: center;
          }
          .total-label {
            font-size: 14px;
            opacity: 0.9;
          }
          .total-amount {
            font-size: 32px;
            font-weight: bold;
            margin-top: 5px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #888;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="business-info">
            <h1 class="business-name">${invoice.business_name}</h1>
            <p class="business-id">ח.פ. ${invoice.business_id}</p>
          </div>
          <div class="invoice-info">
            <div class="invoice-number">חשבונית מס׳ ${invoice.invoice_number}</div>
            <div class="invoice-date">תאריך: ${format(new Date(invoice.issued_at), 'dd/MM/yyyy', { locale: he })}</div>
          </div>
        </div>

        <div class="customer-section">
          <p class="section-title">פרטי לקוח</p>
          <p class="customer-name">${invoice.customer_name}</p>
        </div>

        <table class="details-table">
          <thead>
            <tr>
              <th>תיאור</th>
              <th>סכום</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoice.description || 'חיוב'}</td>
              <td>${invoice.currency === 'ILS' ? '₪' : '$'}${invoice.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <div class="total-label">סה״כ לתשלום</div>
            <div class="total-amount">${invoice.currency === 'ILS' ? '₪' : '$'}${invoice.amount.toFixed(2)}</div>
          </div>
        </div>

        <div class="footer">
          <p>חשבונית זו הופקה אוטומטית ממערכת דיל סלולר</p>
          <p>תודה על שבחרתם בנו!</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadInvoice = (invoice: Invoice) => {
    const content = `
חשבונית מס׳ ${invoice.invoice_number}
==============================

${invoice.business_name}
ח.פ. ${invoice.business_id}

תאריך: ${format(new Date(invoice.issued_at), 'dd/MM/yyyy', { locale: he })}

פרטי לקוח:
${invoice.customer_name}

פרטי החיוב:
${invoice.description || 'חיוב'}

סכום: ${invoice.currency === 'ILS' ? '₪' : '$'}${invoice.amount.toFixed(2)}

==============================
סה״כ לתשלום: ${invoice.currency === 'ILS' ? '₪' : '$'}${invoice.amount.toFixed(2)}
==============================

חשבונית זו הופקה אוטומטית ממערכת דיל סלולר
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.invoice_number}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'הקובץ הורד',
      description: `חשבונית ${invoice.invoice_number} הורדה בהצלחה`,
    });
  };

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="חשבוניות"
        description="צפייה והורדה של כל החשבוניות שהופקו"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">סה״כ חשבוניות</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <FileText className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">חשבוניות מסוננות</p>
                <p className="text-2xl font-bold">{filteredInvoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">סה״כ סכום</p>
                <p className="text-2xl font-bold">₪{totalAmount.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי שם לקוח, מספר חשבונית או תיאור..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="issued">הופק</SelectItem>
                <SelectItem value="paid">שולם</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">אין חשבוניות</h3>
            <p className="text-muted-foreground">
              {searchTerm || filterStatus !== 'all'
                ? 'לא נמצאו חשבוניות התואמות לחיפוש'
                : 'חשבוניות יופקו אוטומטית אחרי כל חיוב'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מס׳ חשבונית</TableHead>
                <TableHead className="text-right">לקוח</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">סכום</TableHead>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    #{invoice.invoice_number}
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {invoice.description || 'חיוב'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {invoice.currency === 'ILS' ? '₪' : '$'}
                    {invoice.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.issued_at), 'dd/MM/yyyy HH:mm', {
                      locale: he,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printInvoice(invoice)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadInvoice(invoice)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

export default function Invoices() {
  return (
    <ProtectedByPermission permission="view_invoices">
      <InvoicesContent />
    </ProtectedByPermission>
  );
}

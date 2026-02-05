import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, CreditCard, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatPrice } from '@/lib/pricing';
import { ProtectedByPermission } from '@/components/ProtectedByPermission';

interface PaymentTransaction {
  id: string;
  transactionId: string;
  rentalId: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'declined';
  customerName: string | null;
  errorMessage: string | null;
  gatewayResponse: Record<string, unknown> | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  pending: 'ממתין',
  success: 'הצליח',
  failed: 'נכשל',
  declined: 'נדחה',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  declined: <XCircle className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  success: 'bg-primary/10 text-primary border-primary/20',
  failed: 'bg-destructive/10 text-destructive border-destructive/20',
  declined: 'bg-destructive/10 text-destructive border-destructive/20',
};

function PaymentHistoryContent() {
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(
        data?.map((t) => ({
          id: t.id,
          transactionId: t.transaction_id,
          rentalId: t.rental_id,
          amount: t.amount,
          currency: t.currency,
          status: t.status as PaymentTransaction['status'],
          customerName: t.customer_name,
          errorMessage: t.error_message,
          gatewayResponse: t.gateway_response as Record<string, unknown> | null,
          createdAt: t.created_at,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.rentalId?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalSuccess = transactions
    .filter((t) => t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFailed = transactions.filter((t) => t.status === 'failed' || t.status === 'declined').length;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="היסטוריית תשלומים"
        description="צפייה בכל העסקאות שבוצעו במערכת"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">סה"כ עסקאות</p>
              <p className="text-2xl font-bold">{transactions.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">סה"כ נגבה</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(totalSuccess, 'ILS')}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">עסקאות נכשלות</p>
              <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי לקוח, מזהה עסקה או השכרה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 ml-2" />
            <SelectValue placeholder="סנן לפי סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            <SelectItem value="success">הצליח</SelectItem>
            <SelectItem value="failed">נכשל</SelectItem>
            <SelectItem value="declined">נדחה</SelectItem>
            <SelectItem value="pending">ממתין</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchTransactions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </Button>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">מזהה עסקה</TableHead>
              <TableHead className="text-right">פרטים</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">טוען...</p>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="mt-2 text-muted-foreground">לא נמצאו עסקאות</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div className="text-sm">
                      {format(parseISO(transaction.createdAt), 'dd/MM/yyyy', { locale: he })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(transaction.createdAt), 'HH:mm', { locale: he })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{transaction.customerName || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">
                      {formatPrice(transaction.amount, transaction.currency as 'ILS' | 'USD')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${statusColors[transaction.status]}`}
                    >
                      {statusIcons[transaction.status]}
                      {statusLabels[transaction.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded" dir="ltr">
                      {transaction.transactionId.substring(0, 20)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    {transaction.errorMessage && (
                      <span className="text-xs text-destructive">{transaction.errorMessage}</span>
                    )}
                    {transaction.status === 'success' && transaction.gatewayResponse && (
                      <span className="text-xs text-primary">
                        אישור: {String((transaction.gatewayResponse as Record<string, unknown>).DebitApproveNumber || 'N/A')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PaymentHistory() {
  return (
    <ProtectedByPermission permission="view_payments">
      <PaymentHistoryContent />
    </ProtectedByPermission>
  );
}

import { useState, useMemo } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Smartphone,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn, normalizeForSearch } from '@/lib/utils';
import { SimCard } from '@/hooks/useCellstationSync';

interface ExpiredSimsTabProps {
  simCards: SimCard[];
  isLoading: boolean;
}

type ExpiredReason = 'expired' | 'inactive' | 'both';

export function ExpiredSimsTab({
  simCards,
  isLoading,
}: ExpiredSimsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter expired or inactive SIMs
  const expiredSims = useMemo(() => {
    const today = new Date();
    
    return simCards.filter(sim => {
      // Check if inactive
      if (sim.is_active === false) return true;
      
      // Check if expired
      if (sim.expiry_date) {
        const expiryDate = parseISO(sim.expiry_date);
        if (expiryDate < today) return true;
      }
      
      return false;
    }).map(sim => {
      const today = new Date();
      let reason: ExpiredReason = 'inactive';
      let daysExpired = 0;
      
      const isInactive = sim.is_active === false;
      let isExpired = false;
      
      if (sim.expiry_date) {
        const expiryDate = parseISO(sim.expiry_date);
        isExpired = expiryDate < today;
        if (isExpired) {
          daysExpired = differenceInDays(today, expiryDate);
        }
      }
      
      if (isInactive && isExpired) {
        reason = 'both';
      } else if (isExpired) {
        reason = 'expired';
      } else {
        reason = 'inactive';
      }
      
      return { ...sim, reason, daysExpired };
    });
  }, [simCards]);

  // Apply search filter
  const filteredSims = useMemo(() => {
    if (!searchTerm) return expiredSims;
    
    const searchNormalized = normalizeForSearch(searchTerm);
    
    return expiredSims.filter(sim => {
      const localNorm = normalizeForSearch(sim.local_number);
      const simNorm = normalizeForSearch(sim.sim_number);
      
      return localNorm.includes(searchNormalized) ||
             simNorm.includes(searchNormalized);
    });
  }, [expiredSims, searchTerm]);

  // Get reason badge
  const getReasonBadge = (reason: ExpiredReason, daysExpired: number) => {
    switch (reason) {
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            פג לפני {daysExpired} ימים
          </Badge>
        );
      case 'inactive':
        return (
          <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3" />
            לא פעיל
          </Badge>
        );
      case 'both':
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="destructive" className="gap-1">
              <Clock className="h-3 w-3" />
              פג לפני {daysExpired} ימים
            </Badge>
            <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
              <XCircle className="h-3 w-3" />
              לא פעיל
            </Badge>
          </div>
        );
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="🔍 חיפוש לפי מספר..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 rounded-lg">
            <Clock className="h-4 w-4 text-destructive" />
            <span className="text-sm">
              פג תוקף: {expiredSims.filter(s => s.reason === 'expired' || s.reason === 'both').length}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              לא פעילים: {expiredSims.filter(s => s.reason === 'inactive' || s.reason === 'both').length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSims.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין סימים שפג תוקפם או לא פעילים 🎉</p>
            <p className="text-sm mt-2">
              כל הסימים בתוקף ופעילים
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-right" dir="rtl">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מספר מקומי</TableHead>
                  <TableHead className="text-right">מספר ישראלי</TableHead>
                  <TableHead className="text-right">ICCID</TableHead>
                  <TableHead className="text-right">תוקף</TableHead>
                  <TableHead className="text-right">חבילה</TableHead>
                  <TableHead className="text-right">סיבה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSims.map((sim) => (
                  <TableRow 
                    key={sim.id}
                    className={cn(
                      sim.reason === 'expired' || sim.reason === 'both' 
                        ? 'bg-destructive/5' 
                        : 'bg-muted/30'
                    )}
                  >
                    <TableCell className="font-mono font-medium">
                      {sim.local_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono">
                      {sim.israeli_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {sim.sim_number ? `...${sim.sim_number.slice(-8)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {sim.expiry_date 
                        ? format(parseISO(sim.expiry_date), 'dd/MM/yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sim.package_name || '-'}
                    </TableCell>
                    <TableCell>
                      {getReasonBadge(sim.reason, sim.daysExpired)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Info note */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
            <div>
              <p className="font-medium">סימים אלו לא ניתנים להפעלה</p>
              <p>יש לחדש את הסימים דרך פורטל CellStation או ליצור קשר עם הספק.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { useUSSims } from '@/hooks/useUSSims';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { USSimStatus, USSim } from '@/types/rental';
import { Plus, Copy, Link2, Trash2, CheckCircle, Globe, RotateCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const US_COMPANIES = [
  'T-Mobile',
  'AT&T',
  'Verizon',
  'Ultra Mobile',
  'H2O Wireless',
  'Mint Mobile',
  'Cricket',
  'Boost Mobile',
  'Other',
];

const statusColors: Record<USSimStatus, string> = {
  pending:    'bg-gray-100 text-gray-600',
  activating: 'bg-orange-100 text-orange-700',
  active:     'bg-green-100 text-green-700',
  returned:   'bg-blue-100 text-blue-700',
};

const statusLabels: Record<USSimStatus, string> = {
  pending:    'ממתין',
  activating: 'בהפעלה',
  active:     'פעיל',
  returned:   'הוחזר',
};

export default function USSims() {
  const { sims, loading, activatorToken, addSim, deleteSim, markReturned, renewSim } = useUSSims();
  const { toast } = useToast();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCompany, setNewCompany] = useState('T-Mobile');
  const [newSimNumber, setNewSimNumber] = useState('');
  const [newPackage, setNewPackage] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Renewal dialog state
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewSimId, setRenewSimId] = useState<string | null>(null);
  const [renewContact, setRenewContact] = useState('');
  const [renewMethod, setRenewMethod] = useState<'whatsapp' | 'email' | 'none'>('whatsapp');
  const [renewIncludesIsraeli, setRenewIncludesIsraeli] = useState(false);
  const [isRenewSaving, setIsRenewSaving] = useState(false);

  const activationUrl = activatorToken
    ? `${window.location.origin}/activate/${activatorToken}`
    : null;

  const copyLink = () => {
    if (!activationUrl) return;
    navigator.clipboard.writeText(activationUrl);
    toast({ title: 'הקישור הועתק', description: 'שלח אותו לאיש הקשר שלך בארה"ב' });
  };

  const handleAdd = async () => {
    if (!newCompany) return;
    setIsSaving(true);
    const price = newPrice ? parseFloat(newPrice) : undefined;
    const { error } = await addSim(newCompany, newSimNumber || undefined, newPackage || undefined, newNotes || undefined, price);
    setIsSaving(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'הסים נוסף', description: `${newCompany} נוסף למערכת` });
      setIsAddOpen(false);
      setNewCompany('T-Mobile');
      setNewSimNumber('');
      setNewPackage('');
      setNewPrice('');
      setNewNotes('');
    }
  };

  const handleDelete = async (id: string, company: string) => {
    const { error } = await deleteSim(id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'הסים נמחק', description: `${company} הוסר` });
    }
  };

  const handleMarkReturned = async (id: string, company: string) => {
    const { error } = await markReturned(id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'עודכן', description: `${company} סומן כהוחזר` });
    }
  };

  const openRenewDialog = (simId: string) => {
    setRenewSimId(simId);
    setRenewContact('');
    setRenewMethod('whatsapp');
    setRenewIncludesIsraeli(false);
    setIsRenewOpen(true);
  };

  const handleRenew = async () => {
    if (!renewSimId) return;
    if (renewMethod !== 'none' && !renewContact) {
      toast({ title: 'שגיאה', description: 'יש להזין איש קשר' });
      return;
    }

    setIsRenewSaving(true);
    const { error } = await renewSim(
      renewSimId,
      1, // hardcoded to 1 month as per user requirement
      renewMethod !== 'none' ? renewContact : undefined,
      renewMethod !== 'none' ? renewMethod : undefined,
      renewIncludesIsraeli
    );
    setIsRenewSaving(false);

    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      const sim = sims.find(s => s.id === renewSimId);
      toast({ title: 'הורחק', description: `${sim?.simCompany} הורחק לחודש נוסף` });
      setIsRenewOpen(false);
    }
  };

  const pendingCount    = sims.filter(s => s.status === 'pending').length;
  const activatingCount = sims.filter(s => s.status === 'activating').length;
  const activeCount     = sims.filter(s => s.status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title='סימים ארה"ב' description="ניהול סימים אמריקאים לשליחה ולהפעלה">
        <Button variant="glow" onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף סים
        </Button>
      </PageHeader>

      {/* Quick Link Button */}
      {activationUrl && (
        <div className="mb-6 flex gap-2">
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy className="h-4 w-4" />
            העתק קישור הפעלה
          </Button>
          <p className="text-xs text-muted-foreground self-center">שלח לשותף בארה"ב</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'ממתינים',  count: pendingCount,    color: 'text-muted-foreground' },
          { label: 'בהפעלה',   count: activatingCount, color: 'text-warning' },
          { label: 'פעילים',   count: activeCount,     color: 'text-success' },
        ].map(({ label, count, color }) => (
          <div key={label} className="stat-card text-center">
            <div className="relative z-10">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
            <div className="stat-shimmer" />
            <div className="stat-bar" />
          </div>
        ))}
      </div>

      {/* SIMs Table */}
      <div className="stat-card overflow-hidden">
        <div className="relative z-10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">חברה</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר סים</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">חבילה</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מחיר ליום</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר מקומי</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר ישראלי</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">תוקף</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sims.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    אין סימים. לחץ "הוסף סים" כדי להתחיל.
                  </td>
                </tr>
              ) : (
                sims.map((sim) => (
                  <tr key={sim.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{sim.simCompany}</td>
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground" dir="ltr">
                      {sim.simNumber || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{sim.package || '—'}</td>
                    <td className="px-4 py-3 font-medium">
                      {sim.pricePerDay ? `$${sim.pricePerDay.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm" dir="ltr">
                      {sim.localNumber || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm" dir="ltr">
                      {sim.israeliNumber || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sim.expiryDate ? format(parseISO(sim.expiryDate), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[sim.status]}`}>
                        {statusLabels[sim.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {sim.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="הארך לחודש נוסף"
                            onClick={() => openRenewDialog(sim.id)}
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
                        {sim.status !== 'returned' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-success"
                            title="סמן כהוחזר"
                            onClick={() => handleMarkReturned(sim.id, sim.simCompany)}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(sim.id, sim.simCompany)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="stat-shimmer" />
        <div className="stat-bar" />
      </div>

      {/* Add SIM Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוסף סים חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>חברת תקשורת</Label>
              <Select value={newCompany} onValueChange={setNewCompany}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_COMPANIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>מספר סים (אופציונלי)</Label>
              <Input
                placeholder='לדוגמה: 89014104...'
                value={newSimNumber}
                onChange={e => setNewSimNumber(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>חבילה (אופציונלי)</Label>
              <Input
                placeholder='לדוגמה: Talk + Text 30$'
                value={newPackage}
                onChange={e => setNewPackage(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>הערות (אופציונלי)</Label>
              <Input
                placeholder="הערות נוספות..."
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>מחיר יומי בדולר (אופציונלי)</Label>
              <Input
                type="number"
                placeholder='לדוגמה: 5 או 10.50'
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>ביטול</Button>
            <Button variant="glow" onClick={handleAdd} disabled={isSaving || !newCompany}>
              {isSaving ? 'שומר...' : 'הוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew SIM Dialog */}
      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הארך סים לחודש נוסף</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>דרך התנעה</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="radio"
                    id="whatsapp"
                    value="whatsapp"
                    checked={renewMethod === 'whatsapp'}
                    onChange={() => setRenewMethod('whatsapp')}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="whatsapp" className="font-normal cursor-pointer">WhatsApp</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="radio"
                    id="email"
                    value="email"
                    checked={renewMethod === 'email'}
                    onChange={() => setRenewMethod('email')}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="email" className="font-normal cursor-pointer">דוא״ל</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="radio"
                    id="none"
                    value="none"
                    checked={renewMethod === 'none'}
                    onChange={() => setRenewMethod('none')}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="none" className="font-normal cursor-pointer">ללא הודעה</Label>
                </div>
              </div>
            </div>

            {renewMethod !== 'none' && (
              <div className="space-y-1.5">
                <Label>
                  {renewMethod === 'whatsapp' ? 'מספר WhatsApp' : 'כתובת דוא״ל'}
                </Label>
                <Input
                  placeholder={renewMethod === 'whatsapp' ? '+972501234567' : 'example@example.com'}
                  value={renewContact}
                  onChange={e => setRenewContact(e.target.value)}
                  dir={renewMethod === 'whatsapp' ? 'ltr' : 'auto'}
                />
              </div>
            )}

            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="includes-israeli"
                checked={renewIncludesIsraeli}
                onCheckedChange={(checked) => setRenewIncludesIsraeli(checked as boolean)}
              />
              <Label htmlFor="includes-israeli" className="font-normal cursor-pointer">
                כולל מספר ישראלי חדש
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenewOpen(false)}>ביטול</Button>
            <Button variant="glow" onClick={handleRenew} disabled={isRenewSaving || (renewMethod !== 'none' && !renewContact)}>
              {isRenewSaving ? 'מעדכן...' : 'הארך לחודש נוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

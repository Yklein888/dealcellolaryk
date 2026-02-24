import { useState, useMemo } from 'react';
import { useUSSims } from '@/hooks/useUSSims';
import { useRental } from '@/hooks/useRental';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  USSimStatus,
  USSimPackage,
  PACKAGE_LABELS,
} from '@/types/rental';
import {
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  RotateCw,
  Settings,
  MessageCircle,
  Search,
  ShoppingCart,
  AlertTriangle,
  Clock,
  User,
  CalendarDays,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import {
  USSimQuickRentalDialog,
  EnrichedUSSim,
} from '@/components/ussims/USSimQuickRentalDialog';

// ── Constants ────────────────────────────────────────────────────────────────

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

type DashboardTab = 'all' | 'pending' | 'activating' | 'active' | 'rented' | 'returned';

// ── Component ─────────────────────────────────────────────────────────────────

export default function USSims() {
  const {
    sims,
    loading,
    activatorToken,
    whatsappContact,
    addSim,
    deleteSim,
    markReturned,
    renewSim,
    updateWhatsappContact,
  } = useUSSims();
  const { rentals } = useRental();
  const { toast } = useToast();

  // ── Tab & Search ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<DashboardTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Quick Rental Dialog ─────────────────────────────────────────────────────
  const [quickRentalSim, setQuickRentalSim] = useState<EnrichedUSSim | null>(null);

  // ── Add SIM Dialog ─────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCompany, setNewCompany] = useState('T-Mobile');
  const [newSimNumber, setNewSimNumber] = useState('');
  const [newPackage, setNewPackage] = useState<USSimPackage>('calls_only');
  const [newNotes, setNewNotes] = useState('');
  const [newIncludesIsraeli, setNewIncludesIsraeli] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Settings Dialog ────────────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsWhatsapp, setSettingsWhatsapp] = useState('');

  // ── Renew Dialog ───────────────────────────────────────────────────────────
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [renewSimId, setRenewSimId] = useState<string | null>(null);
  const [renewIncludesIsraeli, setRenewIncludesIsraeli] = useState(false);
  const [isRenewSaving, setIsRenewSaving] = useState(false);

  // ── Activation URL ─────────────────────────────────────────────────────────
  const activationUrl = activatorToken
    ? `${window.location.origin}/activate/${activatorToken}`
    : null;

  const copyLink = () => {
    if (!activationUrl) return;
    navigator.clipboard.writeText(activationUrl);
    toast({
      title: 'הקישור הועתק',
      description: 'שלח אותו לאיש הקשר שלך בארה"ב',
    });
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newCompany) return;
    setIsSaving(true);
    const { error } = await addSim(
      newCompany,
      newSimNumber || undefined,
      newPackage || undefined,
      newNotes || undefined,
      newIncludesIsraeli
    );
    setIsSaving(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'הסים נוסף', description: `${newCompany} נוסף למערכת` });
      setIsAddOpen(false);
      setNewCompany('T-Mobile');
      setNewSimNumber('');
      setNewPackage('calls_only');
      setNewNotes('');
      setNewIncludesIsraeli(false);
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
    setRenewIncludesIsraeli(false);
    setIsRenewOpen(true);
  };

  const handleRenew = async () => {
    if (!renewSimId) return;
    setIsRenewSaving(true);
    const { error } = await renewSim(renewSimId, 1, renewIncludesIsraeli);
    setIsRenewSaving(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      const sim = sims.find((s) => s.id === renewSimId);
      toast({ title: 'הורחק', description: `${sim?.simCompany} הורחק לחודש נוסף` });
      setIsRenewOpen(false);
    }
  };

  const handleSaveSettings = async () => {
    const { error } = await updateWhatsappContact(settingsWhatsapp);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ נשמר', description: 'מספר הוואטסאפ עודכן' });
      setIsSettingsOpen(false);
    }
  };

  // ── Enriched SIMs (join with rentals) ──────────────────────────────────────

  const enrichedSims = useMemo<EnrichedUSSim[]>(() => {
    const today = new Date();
    return sims.map((sim) => {
      const virtualId = `us-sim-${sim.id}`;
      const linkedRental =
        rentals.find(
          (r) =>
            (r.status === 'active' || r.status === 'overdue') &&
            r.items.some((item) => item.inventoryItemId === virtualId)
        ) ?? null;

      const isRented = linkedRental !== null;
      const isOverdue = linkedRental?.status === 'overdue' ?? false;

      let daysUntilExpiry: number | null = null;
      let isExpiringSoon = false;
      if (sim.expiryDate) {
        const expiry = parseISO(sim.expiryDate);
        daysUntilExpiry = differenceInDays(expiry, today);
        isExpiringSoon =
          daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && sim.status === 'active';
      }

      return {
        ...sim,
        linkedRental,
        customerName: linkedRental?.customerName ?? null,
        rentalEndDate: linkedRental?.endDate ?? null,
        isRented,
        isOverdue,
        isExpiringSoon,
        daysUntilExpiry,
      };
    });
  }, [sims, rentals]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(
    () => ({
      pending:      enrichedSims.filter((s) => s.status === 'pending').length,
      activating:   enrichedSims.filter((s) => s.status === 'activating').length,
      active:       enrichedSims.filter((s) => s.status === 'active' && !s.isRented).length,
      rented:       enrichedSims.filter((s) => s.isRented).length,
      overdue:      enrichedSims.filter((s) => s.isOverdue).length,
      expiringSoon: enrichedSims.filter((s) => s.isExpiringSoon).length,
      returned:     enrichedSims.filter((s) => s.status === 'returned').length,
    }),
    [enrichedSims]
  );

  // ── Filtered SIMs ──────────────────────────────────────────────────────────

  const filteredSims = useMemo<EnrichedUSSim[]>(() => {
    return enrichedSims.filter((sim) => {
      const tabMatch = (() => {
        switch (activeTab) {
          case 'all':        return sim.status !== 'returned';
          case 'pending':    return sim.status === 'pending';
          case 'activating': return sim.status === 'activating';
          case 'active':     return sim.status === 'active' && !sim.isRented;
          case 'rented':     return sim.isRented;
          case 'returned':   return sim.status === 'returned';
        }
      })();
      if (!tabMatch) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sim.simCompany.toLowerCase().includes(q) ||
        (sim.localNumber ?? '').toLowerCase().includes(q) ||
        (sim.israeliNumber ?? '').toLowerCase().includes(q) ||
        (sim.simNumber ?? '').toLowerCase().includes(q) ||
        (sim.customerName ?? '').toLowerCase().includes(q) ||
        (sim.package ? PACKAGE_LABELS[sim.package] : '').toLowerCase().includes(q)
      );
    });
  }, [enrichedSims, activeTab, searchQuery]);

  // ── Tab definitions ────────────────────────────────────────────────────────

  const tabs: { id: DashboardTab; label: string; count: number }[] = [
    { id: 'all',        label: 'הכל',    count: enrichedSims.filter((s) => s.status !== 'returned').length },
    { id: 'pending',    label: 'ממתין',  count: stats.pending },
    { id: 'activating', label: 'בהפעלה', count: stats.activating },
    { id: 'active',     label: 'פעיל',   count: stats.active },
    { id: 'rented',     label: 'מושכר',  count: stats.rented },
    { id: 'returned',   label: 'הוחזר',  count: stats.returned },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <PageHeader title='סימים ארה"ב' description="ניהול סימים אמריקאים – הפעלה, מלאי והשכרה">
        <Button
          variant="outline"
          onClick={() => {
            setSettingsWhatsapp(whatsappContact ?? '');
            setIsSettingsOpen(true);
          }}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          הגדרות
        </Button>
        <Button variant="glow" onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          הוסף סים
        </Button>
      </PageHeader>

      {/* ── Activation URL ─────────────────────────────────────────────────── */}
      {activationUrl && (
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          <Button variant="outline" onClick={copyLink} className="gap-2">
            <Copy className="h-4 w-4" />
            העתק קישור הפעלה
          </Button>
          <p className="text-xs text-muted-foreground">שלח לשותף בארה"ב לצורך הזנת המספרים</p>
        </div>
      )}

      {/* ── Stats Cards (6) ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'ממתינים',       count: stats.pending,      color: 'text-muted-foreground', tab: 'pending'    as DashboardTab },
          { label: 'בהפעלה',        count: stats.activating,   color: 'text-orange-500',        tab: 'activating' as DashboardTab },
          { label: 'פעילים',        count: stats.active,       color: 'text-green-500',         tab: 'active'     as DashboardTab },
          { label: 'מושכרים',       count: stats.rented,       color: 'text-blue-500',          tab: 'rented'     as DashboardTab },
          { label: 'באיחור',        count: stats.overdue,      color: 'text-red-500',           tab: 'rented'     as DashboardTab },
          { label: 'פג תוקף בקרוב', count: stats.expiringSoon, color: 'text-yellow-500',        tab: 'active'     as DashboardTab },
        ].map(({ label, count, color, tab }) => (
          <button
            key={label}
            onClick={() => setActiveTab(tab)}
            className="stat-card text-center cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="relative z-10">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
            </div>
            <div className="stat-shimmer" />
            <div className="stat-bar" />
          </button>
        ))}
      </div>

      {/* ── Alert Banners ──────────────────────────────────────────────────── */}
      {stats.overdue > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {stats.overdue === 1
              ? 'יש סים אחד בהשכרה שעבר את תאריך הסיום'
              : `יש ${stats.overdue} סימים בהשכרה שעברו את תאריך הסיום`}
          </span>
          <button className="mr-auto text-xs underline" onClick={() => setActiveTab('rented')}>
            הצג
          </button>
        </div>
      )}

      {stats.expiringSoon > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            {stats.expiringSoon === 1
              ? 'סים אחד יפוג תוקפו בשבוע הקרוב'
              : `${stats.expiringSoon} סימים יפגו תוקפם בשבוע הקרוב`}
          </span>
          <button className="mr-auto text-xs underline" onClick={() => setActiveTab('active')}>
            הצג
          </button>
        </div>
      )}

      {/* ── Search + Tabs ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder='חיפוש לפי חברה, מספר, לקוח...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-background text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3 mb-4">
        {filteredSims.length === 0 ? (
          <div className="stat-card text-center py-12 text-muted-foreground">
            <p>{searchQuery ? 'לא נמצאו סימים התואמים לחיפוש' : 'אין סימים להצגה'}</p>
          </div>
        ) : (
          filteredSims.map((sim) => (
            <div key={sim.id} className={`stat-card p-4 space-y-3 ${sim.isOverdue ? 'border-red-200 dark:border-red-800' : ''}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{sim.simCompany}</p>
                  {sim.package && (
                    <p className="text-xs text-muted-foreground">{PACKAGE_LABELS[sim.package]}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[sim.status]}`}>
                    {statusLabels[sim.status]}
                  </span>
                  {sim.isRented && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      מושכר
                    </span>
                  )}
                </div>
              </div>

              {/* Numbers */}
              {(sim.localNumber || sim.israeliNumber) && (
                <div className="space-y-1 text-xs">
                  {sim.localNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16">📱 US</span>
                      <span dir="ltr" className="font-mono">{sim.localNumber}</span>
                    </div>
                  )}
                  {sim.israeliNumber && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-16">🇮🇱 ישראל</span>
                      <span dir="ltr" className="font-mono">{sim.israeliNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Expiry */}
              {sim.expiryDate && (
                <div className={`flex items-center gap-1.5 text-xs ${sim.isExpiringSoon ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}`}>
                  <CalendarDays className="h-3.5 w-3.5" />
                  תוקף: {format(parseISO(sim.expiryDate), 'dd/MM/yyyy')}
                  {sim.isExpiringSoon && sim.daysUntilExpiry !== null && (
                    <span>({sim.daysUntilExpiry} ימים)</span>
                  )}
                </div>
              )}

              {/* Customer rental info */}
              {sim.isRented && sim.customerName && (
                <div className={`flex items-center gap-1.5 text-xs ${sim.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                  <User className="h-3.5 w-3.5" />
                  {sim.customerName}
                  {sim.rentalEndDate && (
                    <span>• עד {format(parseISO(sim.rentalEndDate), 'dd/MM/yyyy')}</span>
                  )}
                  {sim.isOverdue && <span>⚠ באיחור</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                {sim.status === 'active' && !sim.isRented && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => setQuickRentalSim(sim)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    השכר
                  </Button>
                )}
                {sim.status === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    onClick={() => openRenewDialog(sim.id)}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    הארך
                  </Button>
                )}
                {sim.status !== 'returned' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    onClick={() => handleMarkReturned(sim.id, sim.simCompany)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    החזר
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 mr-auto text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(sim.id, sim.simCompany)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop Table ──────────────────────────────────────────────────── */}
      <div className="hidden lg:block stat-card overflow-hidden">
        <div className="relative z-10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">חברה</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר סים</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">חבילה</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר מקומי</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">מספר ישראלי</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">תוקף</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">לקוח</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">סטטוס</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredSims.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-muted-foreground">
                    {searchQuery ? 'לא נמצאו סימים התואמים לחיפוש' : 'אין סימים להצגה'}
                  </td>
                </tr>
              ) : (
                filteredSims.map((sim) => (
                  <tr
                    key={sim.id}
                    className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                      sim.isOverdue ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                    }`}
                  >
                    {/* Company */}
                    <td className="px-4 py-3 font-medium">{sim.simCompany}</td>

                    {/* SIM # */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground" dir="ltr">
                      {sim.simNumber || '—'}
                    </td>

                    {/* Package */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {sim.package ? PACKAGE_LABELS[sim.package] : '—'}
                    </td>

                    {/* Local number */}
                    <td className="px-4 py-3 font-mono text-sm" dir="ltr">
                      {sim.localNumber || <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Israeli number */}
                    <td className="px-4 py-3 font-mono text-sm" dir="ltr">
                      {sim.israeliNumber || <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Expiry */}
                    <td className={`px-4 py-3 text-sm ${sim.isExpiringSoon ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}`}>
                      {sim.expiryDate ? (
                        <span className="flex items-center gap-1">
                          {format(parseISO(sim.expiryDate), 'dd/MM/yyyy')}
                          {sim.isExpiringSoon && sim.daysUntilExpiry !== null && (
                            <span className="text-xs">({sim.daysUntilExpiry}י׳)</span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      {sim.isRented && sim.customerName ? (
                        <div className={`text-sm ${sim.isOverdue ? 'text-red-600' : ''}`}>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="font-medium">{sim.customerName}</span>
                            {sim.isOverdue && <span className="text-xs">⚠</span>}
                          </div>
                          {sim.rentalEndDate && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              עד {format(parseISO(sim.rentalEndDate), 'dd/MM/yyyy')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[sim.status]}`}>
                          {statusLabels[sim.status]}
                        </span>
                        {sim.isRented && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            מושכר
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {sim.status === 'active' && !sim.isRented && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            title="השכר ללקוח"
                            onClick={() => setQuickRentalSim(sim)}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        )}
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

      {/* ── Quick Rental Dialog ────────────────────────────────────────────── */}
      {quickRentalSim && (
        <USSimQuickRentalDialog
          sim={quickRentalSim}
          isOpen={!!quickRentalSim}
          onClose={() => setQuickRentalSim(null)}
        />
      )}

      {/* ── Add SIM Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הוסף סים חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>חברת תקשורת</Label>
              <Select value={newCompany} onValueChange={setNewCompany}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {US_COMPANIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>מספר סים (אופציונלי)</Label>
              <Input
                placeholder="לדוגמה: 89014104..."
                value={newSimNumber}
                onChange={(e) => setNewSimNumber(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label>חבילה</Label>
              <Select value={newPackage} onValueChange={(val) => setNewPackage(val as USSimPackage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="calls_only">שיחות בלבד</SelectItem>
                  <SelectItem value="gb_8">8GB</SelectItem>
                  <SelectItem value="unlimited">ללא הגבלה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>הערות (אופציונלי)</Label>
              <Input
                placeholder="הערות נוספות..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="new-includes-israeli"
                checked={newIncludesIsraeli}
                onCheckedChange={(checked) => setNewIncludesIsraeli(checked as boolean)}
              />
              <Label htmlFor="new-includes-israeli" className="font-normal cursor-pointer">
                כולל מספר ישראלי
              </Label>
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

      {/* ── Settings Dialog ────────────────────────────────────────────────── */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              הגדרות התראות WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              הגדר את מספר הוואטסאפ שאליו יישלחו התראות אוטומטיות כאשר סים משנה סטטוס.
            </p>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-contact">מספר וואטסאפ</Label>
              <Input
                id="whatsapp-contact"
                dir="ltr"
                placeholder="+1-555-000-0000"
                value={settingsWhatsapp}
                onChange={(e) => setSettingsWhatsapp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">כולל קידומת מדינה, לדוגמה: +1-555-000-0000</p>
            </div>
            {whatsappContact && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <span>מספר נוכחי: <span dir="ltr" className="font-mono">{whatsappContact}</span></span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>ביטול</Button>
            <Button variant="glow" onClick={handleSaveSettings} disabled={!settingsWhatsapp}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Renew SIM Dialog ───────────────────────────────────────────────── */}
      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הארך סים לחודש נוסף</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="renewal-includes-israeli"
                checked={renewIncludesIsraeli}
                onCheckedChange={(checked) => setRenewIncludesIsraeli(checked as boolean)}
              />
              <Label htmlFor="renewal-includes-israeli" className="font-normal cursor-pointer">
                להוסיף מספר ישראלי גם לחידוש?
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              ההודעה תשלח לאיש הקשר בארה״ב דרך WhatsApp
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenewOpen(false)}>ביטול</Button>
            <Button variant="glow" onClick={handleRenew} disabled={isRenewSaving}>
              {isRenewSaving ? 'מעדכן...' : 'הארך לחודש נוסף'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

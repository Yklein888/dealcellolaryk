import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { simManagerClient } from '@/integrations/supabase/simManagerClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Globe, AlertCircle, CheckCircle } from 'lucide-react';

interface SimRow {
  id: string;
  sim_company: string;
  package: string | null;
  local_number: string | null;
  israeli_number: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
}

// Edits per SIM id
type Edits = Record<string, { local: string; israeli: string; expiry: string }>;

const statusColors: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-600',
  activating: 'bg-orange-100 text-orange-700',
  active:     'bg-green-100 text-green-700',
};
const statusLabels: Record<string, string> = {
  pending:    'ממתין',
  activating: 'בהפעלה',
  active:     'פעיל',
};

export default function SimActivation() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [sims, setSims] = useState<SimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Edits>({});

  const fetchSims = useCallback(async () => {
    if (!token) return;
    const { data, error } = await simManagerClient.rpc('get_sims_by_token', { p_token: token });
    if (error) {
      setTokenInvalid(true);
    } else {
      setTokenInvalid(false);
      setSims((data ?? []) as SimRow[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchSims();
    const interval = setInterval(fetchSims, 60_000);
    return () => clearInterval(interval);
  }, [fetchSims]);

  const getField = (id: string, field: 'local' | 'israeli' | 'expiry', dbValue: string | null) =>
    edits[id]?.[field] ?? (dbValue ?? '');

  const setField = (id: string, field: 'local' | 'israeli' | 'expiry', value: string) =>
    setEdits(prev => ({
      ...prev,
      [id]: { local: '', israeli: '', expiry: '', ...prev[id], [field]: value },
    }));

  const handleSave = async (sim: SimRow) => {
    if (!token) return;
    setSaving(sim.id);

    const e = edits[sim.id];
    const pLocal    = e?.local    || sim.local_number    || null;
    const pIsraeli  = e?.israeli  || sim.israeli_number  || null;
    const pExpiry   = e?.expiry   || sim.expiry_date     || null;

    const { data, error } = await simManagerClient.rpc('update_sim_activation', {
      p_id:      sim.id,
      p_token:   token,
      p_local:   pLocal,
      p_israeli: pIsraeli,
      p_expiry:  pExpiry,
    });

    setSaving(null);
    const result = data as { error?: string; success?: boolean } | null;
    if (error || result?.error) {
      toast({ title: 'שגיאה', description: result?.error ?? error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'נשמר', description: `${sim.sim_company} עודכן בהצלחה` });
      // Clear local edits for this sim after save
      setEdits(prev => { const next = { ...prev }; delete next[sim.id]; return next; });
      fetchSims();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tokenInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">קישור לא תקין</h1>
          <p className="text-muted-foreground">
            הקישור שבידיך אינו תקין. פנה אל הבעלים לקבלת קישור חדש.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster />
      <div className="min-h-screen p-4 sm:p-8" dir="rtl">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">הפעלת סימים</h1>
              <p className="text-sm text-muted-foreground">עדכן את הפרטים עבור כל סים</p>
            </div>
          </div>

          {sims.length === 0 ? (
            <div className="stat-card text-center py-16">
              <div className="relative z-10">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <p className="text-muted-foreground">אין סימים הממתינים להפעלה כרגע.</p>
                <p className="text-xs text-muted-foreground mt-1">הדף מתרענן אוטומטית כל דקה</p>
              </div>
              <div className="stat-shimmer" />
              <div className="stat-bar" />
            </div>
          ) : (
            <div className="space-y-4">
              {sims.map(sim => (
                <div key={sim.id} className="stat-card">
                  <div className="relative z-10">
                    {/* SIM header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{sim.sim_company}</h3>
                        {sim.package && <p className="text-sm text-muted-foreground">{sim.package}</p>}
                        {sim.notes   && <p className="text-xs text-muted-foreground mt-0.5">{sim.notes}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[sim.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[sim.status] ?? sim.status}
                      </span>
                    </div>

                    {/* Editable fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">מספר מקומי (US)</Label>
                        <Input
                          placeholder="+1 555-000-0000"
                          value={getField(sim.id, 'local', sim.local_number)}
                          onChange={e => setField(sim.id, 'local', e.target.value)}
                          className="font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">מספר ישראלי</Label>
                        <Input
                          placeholder="05X-XXXXXXX"
                          value={getField(sim.id, 'israeli', sim.israeli_number)}
                          onChange={e => setField(sim.id, 'israeli', e.target.value)}
                          className="font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">תאריך תפוגה</Label>
                        <Input
                          type="date"
                          value={getField(sim.id, 'expiry', sim.expiry_date)}
                          onChange={e => setField(sim.id, 'expiry', e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      variant="glow"
                      className="w-full"
                      disabled={saving === sim.id}
                      onClick={() => handleSave(sim)}
                    >
                      {saving === sim.id ? 'שומר...' : 'שמור'}
                    </Button>
                  </div>
                  <div className="stat-shimmer" />
                  <div className="stat-bar" />
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-8">
            הדף מתרענן אוטומטית כל דקה
          </p>
        </div>
      </div>
    </>
  );
}

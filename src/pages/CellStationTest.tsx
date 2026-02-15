import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface SimResult {
  sim_number: string | null;
  uk_number: string | null;
  il_number: string | null;
  iccid: string | null;
  status_raw: string | null;
  expiry_date: string | null;
  plan: string | null;
}

export default function CellStationTest() {
  const [sims, setSims] = useState<SimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncCSV = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('cellstation-api', {
        body: { action: 'sync_csv', params: {} },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      setSims(data.sims || []);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>CellStation API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={syncCSV} disabled={loading}>
            {loading ? 'טוען...' : 'סנכרון CSV'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {!loading && sims.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">נמצאו {sims.length} סימים</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SIM Number</TableHead>
                    <TableHead>UK Number</TableHead>
                    <TableHead>IL Number</TableHead>
                    <TableHead>ICCID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sims.map((sim, i) => (
                    <TableRow key={i}>
                      <TableCell>{sim.sim_number}</TableCell>
                      <TableCell>{sim.uk_number}</TableCell>
                      <TableCell>{sim.il_number}</TableCell>
                      <TableCell className="font-mono text-xs">{sim.iccid}</TableCell>
                      <TableCell>{sim.status_raw}</TableCell>
                      <TableCell>{sim.expiry_date}</TableCell>
                      <TableCell>{sim.plan}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

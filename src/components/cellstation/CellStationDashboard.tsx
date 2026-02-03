import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Smartphone, Zap, Users, CloudDownload } from 'lucide-react';
import { useCellstationSync, SimCard } from '@/hooks/useCellstationSync';
import { useRental } from '@/hooks/useRental';
import { SimInventoryTab } from './SimInventoryTab';
import { ActivationTab } from './ActivationTab';
import { CustomersTab } from './CustomersTab';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export function CellStationDashboard() {
  const { simCards, isLoading, isRefreshing, isSyncing, syncSims, refreshData } = useCellstationSync();
  const { customers, inventory, addCustomer, addInventoryItem, addRental } = useRental();
  const [activeTab, setActiveTab] = useState('inventory');
  const [selectedSimForActivation, setSelectedSimForActivation] = useState<SimCard | null>(null);

  // Check if a SIM is already in inventory
  const isSimInInventory = (simNumber: string | null): boolean => {
    if (!simNumber) return false;
    return inventory.some(item => item.simNumber === simNumber);
  };

  // Calculate stats
  const stats = {
    total: simCards.length,
    active: simCards.filter(s => s.is_active === true).length,
    inactive: simCards.filter(s => s.is_active === false).length,
    availableForActivation: simCards.filter(s => 
      s.is_active === true && !s.is_rented && !isSimInInventory(s.sim_number)
    ).length,
  };

  const lastSyncTime = simCards.length > 0 && simCards[0].last_synced
    ? format(new Date(simCards[0].last_synced), 'dd/MM/yyyy HH:mm', { locale: he })
    : 'לא סונכרן';

  // Handler to switch to activation tab with a pre-selected SIM
  const handleActivateSim = (sim: SimCard) => {
    setSelectedSimForActivation(sim);
    setActiveTab('activate');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">דאשבורד CellStation</h1>
          <p className="text-muted-foreground">
            סנכרון אחרון: {lastSyncTime} • ניהול סימים, הפעלות והשכרות
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={syncSims}
            disabled={isLoading || isSyncing}
            className="gap-2"
          >
            <CloudDownload className={cn("h-4 w-4", isSyncing && "animate-bounce")} />
            {isSyncing ? 'מסנכרן...' : 'סנכרן סימים'}
          </Button>
          <Button 
            onClick={refreshData}
            disabled={isLoading || isRefreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", (isLoading || isRefreshing) && "animate-spin")} />
            {isRefreshing ? 'מרענן...' : 'רענן'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ סימים</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">ב-CellStation</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">פעילים</CardTitle>
            <Package className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.active}</div>
            <p className="text-xs text-muted-foreground">סימים פעילים</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">לא פעילים</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">דורשים הפעלה</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">זמינים להפעלה</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.availableForActivation}</div>
            <p className="text-xs text-muted-foreground">פעילים ולא מושכרים</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            מלאי סימים
          </TabsTrigger>
          <TabsTrigger value="activate" className="gap-2">
            <Zap className="h-4 w-4" />
            הפעלה חדשה
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            לקוחות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <SimInventoryTab 
            simCards={simCards}
            isLoading={isLoading}
            inventory={inventory}
            onActivate={handleActivateSim}
            onAddToInventory={addInventoryItem}
          />
        </TabsContent>

        <TabsContent value="activate">
          <ActivationTab 
            simCards={simCards}
            customers={customers}
            inventory={inventory}
            selectedSim={selectedSimForActivation}
            onSimChange={setSelectedSimForActivation}
            addCustomer={addCustomer}
            addInventoryItem={addInventoryItem}
            addRental={addRental}
          />
        </TabsContent>

        <TabsContent value="customers">
          <CustomersTab 
            customers={customers}
            addCustomer={addCustomer}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

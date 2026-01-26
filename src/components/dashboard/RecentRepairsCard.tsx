import { Wrench, ArrowLeft, Settings } from 'lucide-react';
import { Repair, repairStatusLabels } from '@/types/rental';
import { StatusBadge } from '@/components/StatusBadge';
import { Link } from 'react-router-dom';

interface RecentRepairsCardProps {
  pendingRepairs: Repair[];
}

export function RecentRepairsCard({ pendingRepairs }: RecentRepairsCardProps) {
  return (
    <div className="stat-card animate-slide-up" style={{ animationDelay: '450ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Wrench className="h-5 w-5 text-warning" />
          תיקונים אחרונים
        </h2>
        <Link 
          to="/repairs" 
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          הצג הכל
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
      
      {pendingRepairs.length === 0 ? (
        <div className="text-center py-8">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">אין תיקונים בתהליך</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRepairs.slice(0, 5).map((repair, index) => (
            <div 
              key={repair.id}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.01]"
              style={{ animationDelay: `${500 + index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
                  repair.status === 'ready' 
                    ? 'bg-gradient-to-br from-success to-green-400 text-white' 
                    : 'bg-gradient-to-br from-primary to-accent text-white'
                }`}>
                  {repair.repairNumber}
                </div>
                <div>
                  <p className="font-medium text-foreground">{repair.customerName}</p>
                  <p className="text-sm text-muted-foreground">{repair.deviceType}</p>
                </div>
              </div>
              <StatusBadge 
                status={repairStatusLabels[repair.status]} 
                variant={
                  repair.status === 'ready' ? 'success' : 
                  repair.status === 'in_lab' ? 'warning' : 'default'
                } 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

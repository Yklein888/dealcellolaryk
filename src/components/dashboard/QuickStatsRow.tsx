import { memo, useMemo } from 'react';
import {
  Calendar,
  Activity,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { Rental, Repair } from '@/types/rental';
import { format, parseISO } from 'date-fns';

interface QuickStatsRowProps {
  rentals: Rental[];
  repairs: Repair[];
  readyRepairs: Repair[];
  isSupported: boolean;
  isSubscribed: boolean;
}

export const QuickStatsRow = memo(function QuickStatsRow({
  rentals,
  repairs,
  readyRepairs,
  isSupported,
  isSubscribed
}: QuickStatsRowProps) {
  const todayReturns = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    return rentals.filter(r => r.status === 'active' && format(parseISO(r.endDate), 'yyyy-MM-dd') === todayStr).length;
  }, [rentals]);

  const metrics = [
    {
      label: 'תיקונים מוכנים',
      value: readyRepairs.length,
      icon: CheckCircle2,
      iconColor: '#16A34A',
      iconBg: '#F0FDF4',
      valueColor: '#16A34A',
    },
    {
      label: 'החזרות היום',
      value: todayReturns,
      icon: Calendar,
      iconColor: '#D97706',
      iconBg: '#FEF3C7',
      valueColor: '#D97706',
    },
    {
      label: 'סה"כ השכרות',
      value: rentals.length,
      icon: Activity,
      iconColor: '#3B82F6',
      iconBg: '#EFF6FF',
      valueColor: '#1E40AF',
    },
    ...(isSupported ? [{
      label: 'התראות פוש',
      value: isSubscribed ? 'מופעלות' : 'לא פעיל',
      icon: Bell,
      iconColor: isSubscribed ? '#16A34A' : '#9CA3AF',
      iconBg: isSubscribed ? '#F0FDF4' : '#F9FAFB',
      valueColor: isSubscribed ? '#16A34A' : '#6B7280',
      isText: true,
    }] : []),
  ];

  const colCount = metrics.length;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      display: 'grid',
      gridTemplateColumns: `repeat(${colCount}, 1fr)`,
      marginBottom: '32px',
      overflow: 'hidden',
    }}>
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <div
            key={i}
            style={{
              padding: '20px 24px',
              borderRight: i < colCount - 1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div style={{
              background: m.iconBg,
              borderRadius: '10px',
              padding: '10px',
              flexShrink: 0,
            }}>
              <Icon style={{ width: 18, height: 18, color: m.iconColor }} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500, margin: '0 0 4px 0' }}>{m.label}</p>
              {'isText' in m && m.isText ? (
                <p style={{ fontSize: '16px', fontWeight: 600, color: m.valueColor, margin: 0 }}>{m.value}</p>
              ) : (
                <p style={{ fontSize: '28px', fontWeight: 700, color: m.valueColor, margin: 0, lineHeight: 1 }}>{m.value}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

import { CellStationDashboard } from '@/components/cellstation';
import { ProtectedByPermission } from '@/components/ProtectedByPermission';

export default function SimCards() {
  return (
    <ProtectedByPermission permission="view_sim_cards">
      <CellStationDashboard />
    </ProtectedByPermission>
  );
}

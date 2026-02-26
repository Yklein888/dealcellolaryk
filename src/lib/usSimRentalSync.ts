import { simManagerClient } from '@/integrations/supabase/simManagerClient';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem } from '@/types/rental';

/**
 * Sync active US SIMs from sim-manager project to main rental inventory
 * This makes US SIMs available for customer rentals
 */
export async function syncActiveUSSimsToInventory(activatorToken: string): Promise<{ synced: number; error?: string }> {
  try {
    // Fetch active US SIMs from sim-manager project
    const { data: sims, error: fetchError } = await simManagerClient.rpc(
      'get_sims_by_token',
      { p_token: activatorToken }
    );

    if (fetchError) {
      return { synced: 0, error: fetchError.message };
    }

    if (!sims || sims.length === 0) {
      return { synced: 0 };
    }

    // Filter only active SIMs that have both numbers filled
    const activeSims = sims.filter(
      (sim: any) =>
        sim.status === 'active' &&
        sim.local_number &&
        sim.israeli_number
    );

    if (activeSims.length === 0) {
      return { synced: 0 };
    }

    // Sync each SIM to rental inventory if not already there
    let syncedCount = 0;
    for (const sim of activeSims) {
      const inventoryName = `${sim.sim_company} (${sim.package || 'בלי הגבלה'})`;

      // Check if already in inventory
      const { data: existing } = await supabase
        .from('inventory_items')
        .select('id')
        .eq('sim_number', sim.sim_number)
        .single();

      if (!existing) {
        // Add to rental inventory
        const { error: insertError } = await supabase
          .from('inventory_items')
          .insert({
            category: 'sim_american',
            name: inventoryName,
            sim_number: sim.sim_number,
            local_number: sim.local_number,
            israeli_number: sim.israeli_number,
            expiry_date: sim.expiry_date,
            status: 'available',
            notes: `סים מ-${sim.sim_company}. כולל מספר ישראלי: ${sim.includes_israeli_number ? 'כן' : 'לא'}`,
          });

        if (!insertError) {
          syncedCount++;
        }
      }
    }

    return { synced: syncedCount };
  } catch (err: any) {
    return { synced: 0, error: err.message };
  }
}

/**
 * Send WhatsApp notification when SIM status changes
 */
export async function sendSimStatusNotification(
  activatorWhatsApp: string | undefined,
  simCompany: string,
  oldStatus: string,
  newStatus: string,
  localNumber?: string,
  israeliNumber?: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    if (!activatorWhatsApp) {
      return { sent: false, error: 'No WhatsApp contact configured' };
    }

    // Build message based on status change
    let message = '';
    if (oldStatus === 'pending' && newStatus === 'activating') {
      message = `🔄 סים ${simCompany} החל בהפעלה. ממתין למספרים...`;
    } else if (oldStatus === 'activating' && newStatus === 'active') {
      message = `✅ סים ${simCompany} הופעל בהצלחה!\n📱 מספר מקומי: ${localNumber || 'לא מוגדר'}\n🇮🇱 מספר ישראלי: ${israeliNumber || 'לא הוגדר'}`;
    } else if (newStatus === 'returned') {
      message = `🔙 סים ${simCompany} הוחזר למלאי`;
    } else {
      message = `📱 סים ${simCompany}: ${newStatus}`;
    }

    // Call API route to send WhatsApp message
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: activatorWhatsApp,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { sent: false, error: errorData.error || 'Failed to send WhatsApp message' };
    }

    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}

/**
 * Check and sync US SIMs periodically
 */
export function setupUSSimSyncInterval(activatorToken: string, intervalMs: number = 5 * 60 * 1000) {
  const interval = setInterval(async () => {
    const result = await syncActiveUSSimsToInventory(activatorToken);
    if (result.synced > 0) {
      console.log(`✅ Synced ${result.synced} active US SIMs to rental inventory`);
    }
  }, intervalMs);

  return () => clearInterval(interval);
}

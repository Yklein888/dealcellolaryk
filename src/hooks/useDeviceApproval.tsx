import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getDeviceInfo } from './useDeviceFingerprint';

interface DeviceApprovalState {
  isDeviceApproved: boolean | null;
  isLoading: boolean;
  deviceRegistered: boolean;
}

export function useDeviceApproval() {
  const { user } = useAuth();
  const [state, setState] = useState<DeviceApprovalState>({
    isDeviceApproved: null,
    isLoading: true,
    deviceRegistered: false,
  });

  useEffect(() => {
    const checkAndRegisterDevice = async () => {
      if (!user) {
        setState({ isDeviceApproved: null, isLoading: false, deviceRegistered: false });
        return;
      }

      try {
        // Get device fingerprint
        const deviceInfo = await getDeviceInfo();
        
        // Check if device is approved using RPC function
        const { data: isApproved, error: checkError } = await supabase.rpc(
          'is_device_approved',
          { _user_id: user.id, _fingerprint: deviceInfo.fingerprint }
        );

        if (checkError) {
          console.error('Error checking device approval:', checkError);
          setState({ isDeviceApproved: false, isLoading: false, deviceRegistered: false });
          return;
        }

        // If device is approved, we're done
        if (isApproved) {
          setState({ isDeviceApproved: true, isLoading: false, deviceRegistered: true });
          return;
        }

        // Check if user is admin - auto-approve their devices
        const { data: isAdmin, error: adminError } = await supabase.rpc(
          'is_admin',
          { _user_id: user.id }
        );

        // Register the device (will be pending approval, unless admin)
        const { data: isNewDevice, error: registerError } = await supabase.rpc(
          'register_device',
          {
            _user_id: user.id,
            _fingerprint: deviceInfo.fingerprint,
            _device_name: deviceInfo.deviceName,
            _browser: deviceInfo.browser,
            _os: deviceInfo.os,
          }
        );

        if (registerError) {
          console.error('Error registering device:', registerError);
        }

        // If admin, auto-approve the device
        if (isAdmin && !adminError) {
          const { error: approveError } = await supabase
            .from('user_devices')
            .update({ is_approved: true })
            .eq('user_id', user.id)
            .eq('device_fingerprint', deviceInfo.fingerprint);

          if (!approveError) {
            setState({ isDeviceApproved: true, isLoading: false, deviceRegistered: true });
            return;
          }
        }

        setState({
          isDeviceApproved: false,
          isLoading: false,
          deviceRegistered: !isNewDevice, // If not new, it was already registered
        });
      } catch (err) {
        console.error('Error in device approval check:', err);
        setState({ isDeviceApproved: false, isLoading: false, deviceRegistered: false });
      }
    };

    checkAndRegisterDevice();
  }, [user]);

  return state;
}

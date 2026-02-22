import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function useDeviceApproval() {
  const { user } = useAuth();

  // All devices are automatically approved
  return {
    isDeviceApproved: true,
    isLoading: false,
    deviceId: 'auto-approved',
  };
}

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export function useDeviceApproval() {
  const { user } = useAuth();

  // All devices are automatically approved
  return {
    isApproved: true,
    isLoading: false,
    deviceId: 'auto-approved',
  };
}

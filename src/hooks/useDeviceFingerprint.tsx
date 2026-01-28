import { useMemo } from 'react';

interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  browser: string;
  os: string;
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
}

function getDeviceName(): string {
  const os = getOS();
  const browser = getBrowser();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';
  return `${deviceType} - ${os} - ${browser}`;
}

async function generateFingerprint(): Promise<string> {
  const components: string[] = [];
  
  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  
  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // Language
  components.push(navigator.language);
  
  // Platform
  components.push(navigator.platform);
  
  // Hardware concurrency
  components.push(String(navigator.hardwareConcurrency || 0));
  
  // Device memory (if available)
  components.push(String((navigator as any).deviceMemory || 0));
  
  // Touch support
  components.push(String('ontouchstart' in window));
  
  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Device fingerprint', 2, 15);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    components.push('canvas-error');
  }
  
  // WebGL info
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    }
  } catch {
    components.push('webgl-error');
  }
  
  // Generate hash
  const data = components.join('|');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.substring(0, 32); // Return first 32 chars
}

export function useDeviceFingerprint() {
  const deviceInfo = useMemo<Promise<DeviceInfo>>(async () => {
    const fingerprint = await generateFingerprint();
    return {
      fingerprint,
      deviceName: getDeviceName(),
      browser: getBrowser(),
      os: getOS(),
    };
  }, []);

  return deviceInfo;
}

// Synchronous version for immediate use
export function getDeviceInfoSync(): Omit<DeviceInfo, 'fingerprint'> {
  return {
    deviceName: getDeviceName(),
    browser: getBrowser(),
    os: getOS(),
  };
}

// Async version to get full info including fingerprint
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const fingerprint = await generateFingerprint();
  return {
    fingerprint,
    deviceName: getDeviceName(),
    browser: getBrowser(),
    os: getOS(),
  };
}

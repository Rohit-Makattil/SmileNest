'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useWebcam() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);

  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    setStream(null);
  }, []);

  const startCamera = useCallback(async (
    targetFacingMode?: 'user' | 'environment',
    targetDeviceId?: string
  ) => {
    stopCamera();
    
    // Yield to the event loop to ensure the camera hardware has fully released
    await new Promise((resolve) => setTimeout(resolve, 100));

    setError(null);
    setPermissionState('loading');

    const fm = targetFacingMode || facingMode;

    // Define constraint fallback options for cross-platform compatibility
    const constraintOptions: MediaStreamConstraints[] = [];

    if (targetDeviceId) {
      // Option 1: Exact target device with ideal resolution
      constraintOptions.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      // Option 2: Fallback with ideal resolution but non-exact device ID matching
      constraintOptions.push({
        video: { deviceId: targetDeviceId, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      // Option 3: Fallback device ID only
      constraintOptions.push({
        video: { deviceId: targetDeviceId },
        audio: false
      });
    } else {
      // Option 1: Target facing mode with ideal resolution
      constraintOptions.push({
        video: { facingMode: fm, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      // Option 2: Target facing mode only
      constraintOptions.push({
        video: { facingMode: { ideal: fm } },
        audio: false
      });
    }

    // Option 4: Universal fallback
    constraintOptions.push({
      video: true,
      audio: false
    });

    let mediaStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintOptions) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) break;
      } catch (err: any) {
        console.warn('getUserMedia failed with constraints:', constraints, err);
        lastError = err;
      }
    }

    if (!mediaStream) {
      console.error('All camera stream access attempts failed:', lastError);
      setPermissionState('denied');
      setError(lastError?.message || 'Could not access camera. Please check permissions.');
      return;
    }

    try {
      setStream(mediaStream);
      activeStreamRef.current = mediaStream;
      setPermissionState('granted');

      // Enumerate available video inputs
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      // Track active device ID and facingMode
      const activeTrack = mediaStream.getVideoTracks()[0];
      if (activeTrack) {
        const settings = activeTrack.getSettings();
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }
        if (settings.facingMode) {
          setFacingMode(settings.facingMode as 'user' | 'environment');
        }
      }
    } catch (err: any) {
      console.error('Failed to post-process camera stream:', err);
      setPermissionState('denied');
      setError(err.message || 'Error configuring camera device.');
    }
  }, [facingMode, stopCamera]);

  const toggleCamera = useCallback(async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    
    // Check if we are on a mobile device
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // If we have multiple devices and are NOT on a mobile device, cycle through device IDs
    if (!isMobile && devices.length > 1) {
      const activeIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
      const nextIndex = (activeIndex + 1) % devices.length;
      const nextDevice = devices[nextIndex];
      if (nextDevice) {
        await startCamera(undefined, nextDevice.deviceId);
        return;
      }
    }
    
    // On mobile (or if there's only 1 device/facingMode on desktop), toggle facingMode directly
    await startCamera(nextMode);
  }, [facingMode, devices, activeDeviceId, startCamera]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    stream,
    devices,
    activeDeviceId,
    facingMode,
    permissionState,
    error,
    startCamera,
    stopCamera,
    toggleCamera,
    setActiveDeviceId
  };
}

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
    setError(null);
    setPermissionState('loading');

    const fm = targetFacingMode || facingMode;

    const constraints: MediaStreamConstraints = {
      video: targetDeviceId 
        ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: fm, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      activeStreamRef.current = mediaStream;
      setPermissionState('granted');

      // Enumerate available video inputs
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setDevices(videoDevices);

      // Track active device ID
      const activeTrack = mediaStream.getVideoTracks()[0];
      if (activeTrack) {
        const settings = activeTrack.getSettings();
        if (settings.deviceId) {
          setActiveDeviceId(settings.deviceId);
        }
      }
    } catch (err: any) {
      console.error('Camera stream access failed:', err);
      setPermissionState('denied');
      setError(err.message || 'Could not access camera. Please check permissions.');
    }
  }, [facingMode, stopCamera]);

  const toggleCamera = useCallback(async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    
    // If we have multiple devices, we can cycle devices, otherwise toggle facingMode
    if (devices.length > 1) {
      const activeIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
      const nextIndex = (activeIndex + 1) % devices.length;
      const nextDevice = devices[nextIndex];
      if (nextDevice) {
        await startCamera(undefined, nextDevice.deviceId);
        return;
      }
    }
    
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

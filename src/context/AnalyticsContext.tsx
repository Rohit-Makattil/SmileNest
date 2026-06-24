'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, isMock } from '@/lib/supabase';

interface LiveStats {
  totalVisitors: number;
  totalCaptures: number;
  totalDownloads: number;
  countriesCount: number;
  countries: string[];
}

interface AnalyticsContextType {
  visitorId: string | null;
  sessionId: string | null;
  liveStats: LiveStats;
  isMockMode: boolean;
  refreshStats: () => Promise<void>;
  logCapture: (type: 'photo' | 'strip' | 'boomerang', filter: string, frame: string, url: string, timeMs: number) => Promise<any>;
  logDownload: (captureId: string, format: 'png' | 'jpg') => Promise<void>;
  logQrShare: (captureId: string) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(isMock);
  const [liveStats, setLiveStats] = useState<LiveStats>({
    totalVisitors: 0,
    totalCaptures: 0,
    totalDownloads: 0,
    countriesCount: 0,
    countries: [],
  });

  const sessionRef = useRef<string | null>(null);

  // Fetch aggregate counts for the home page / landing metrics
  const refreshStats = async () => {
    try {
      if (isMock) {
        // Mock calculations from local storage
        const v = JSON.parse(localStorage.getItem('pb_visitors') || '[]');
        const c = JSON.parse(localStorage.getItem('pb_captures') || '[]');
        const d = JSON.parse(localStorage.getItem('pb_downloads') || '[]');
        const uniqueCountries = Array.from(new Set(v.map((item: any) => item.country || 'Unknown'))).filter(c => c !== 'Unknown') as string[];
        
        setLiveStats({
          totalVisitors: v.length,
          totalCaptures: c.length,
          totalDownloads: d.length,
          countriesCount: Math.max(1, uniqueCountries.length),
          countries: uniqueCountries.length > 0 ? uniqueCountries : ['United States', 'Canada', 'India'],
        });
        return;
      }

      // Real database calculations
      const [visitorsRes, capturesRes, downloadsRes] = await Promise.all([
        supabase.from('visitors').select('country', { count: 'exact' }),
        supabase.from('captures').select('*', { count: 'exact', head: true }),
        supabase.from('downloads').select('*', { count: 'exact', head: true }),
      ]);

      const visitorData = (visitorsRes.data || []) as any[];
      const countriesList = Array.from(new Set(visitorData.map(v => v.country).filter(Boolean)));

      setLiveStats({
        totalVisitors: visitorsRes.count || 0,
        totalCaptures: capturesRes.count || 0,
        totalDownloads: downloadsRes.count || 0,
        countriesCount: countriesList.length || 1,
        countries: countriesList as string[],
      });
    } catch (err) {
      console.error('Error refreshing landing stats:', err);
    }
  };

  // Mount logic: Read or create visitor ID, then initialize session and ping
  useEffect(() => {
    const initTelemetry = async () => {
      if (typeof window === 'undefined') return;

      // 1. Get or create persistent visitor ID
      let localVisitorId = localStorage.getItem('pb_visitor_id');
      let isReturning = true;

      if (!localVisitorId) {
        // Generate random UUID
        localVisitorId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
        localStorage.setItem('pb_visitor_id', localVisitorId);
        isReturning = false;
      }
      setVisitorId(localVisitorId);

      // 2. Log visit session
      try {
        const res = await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: localVisitorId, isReturning }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.sessionId) {
            setSessionId(data.sessionId);
            sessionRef.current = data.sessionId;
            refreshStats(); // Load stats on successful initialization
          }
        }
      } catch (err) {
        console.error('Failed to log telemetry session:', err);
      }
    };

    initTelemetry();
  }, []);

  // Heartbeat ping effect
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(async () => {
      if (!sessionRef.current) return;
      try {
        await fetch('/api/analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionRef.current }),
        });
      } catch (err) {
        console.error('Heartbeat ping error:', err);
      }
    }, 20000); // 20-second intervals

    return () => clearInterval(interval);
  }, [sessionId]);

  // Logging helpers
  const logCapture = async (
    type: 'photo' | 'strip' | 'boomerang',
    filter: string,
    frame: string,
    url: string,
    timeMs: number
  ) => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture',
          visitorId,
          sessionId,
          type,
          filterUsed: filter,
          frameUsed: frame,
          imageUrl: url,
          processingTimeMs: timeMs,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        refreshStats();
        return data.capture;
      }
    } catch (err) {
      console.error('Error logging capture action:', err);
    }
    return null;
  };

  const logDownload = async (captureId: string, format: 'png' | 'jpg') => {
    try {
      await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          captureId,
          format,
        }),
      });
      refreshStats();
    } catch (err) {
      console.error('Error logging download action:', err);
    }
  };

  const logQrShare = async (captureId: string) => {
    try {
      await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qr',
          captureId,
        }),
      });
      refreshStats();
    } catch (err) {
      console.error('Error logging QR share action:', err);
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        visitorId,
        sessionId,
        liveStats,
        isMockMode,
        refreshStats,
        logCapture,
        logDownload,
        logQrShare,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

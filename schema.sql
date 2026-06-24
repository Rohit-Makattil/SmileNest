-- AI PHOTOBOOTH - DATABASE SCHEMA
-- This schema should be run in your Supabase SQL Editor.

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. admin_users
-- Whitelist of users who are allowed to view the admin dashboard
CREATE TABLE public.admin_users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. visitors
-- Tracks unique physical devices using a persistent localstorage UUID
CREATE TABLE public.visitors (
  id UUID PRIMARY KEY, -- Provided client-side (persisted in localStorage)
  is_returning BOOLEAN DEFAULT false NOT NULL,
  country TEXT DEFAULT 'Unknown' NOT NULL,
  browser TEXT DEFAULT 'Unknown' NOT NULL,
  device TEXT DEFAULT 'Unknown' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. sessions
-- Tracks browsing sessions and computes active duration
CREATE TABLE public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0 NOT NULL,
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. captures
-- Consolidated table for all photo, photo strip, gif, and boomerang media captures
CREATE TABLE public.captures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id UUID REFERENCES public.visitors(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'gif', 'boomerang', 'strip')),
  filter_used TEXT NOT NULL,
  frame_used TEXT NOT NULL,
  image_url TEXT NOT NULL, -- Path layout: photobooth/photos, photobooth/gifs, photobooth/boomerangs, photobooth/thumbnails
  processing_time_ms INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. downloads
-- Logs image download counts and formats
CREATE TABLE public.downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_id UUID REFERENCES public.captures(id) ON DELETE CASCADE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('png', 'jpg')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. qr_shares
-- Tracks QR Code triggers
CREATE TABLE public.qr_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_id UUID REFERENCES public.captures(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON public.sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_ping ON public.sessions(last_ping);
CREATE INDEX IF NOT EXISTS idx_captures_visitor_id ON public.captures(visitor_id);
CREATE INDEX IF NOT EXISTS idx_captures_type ON public.captures(type);
CREATE INDEX IF NOT EXISTS idx_captures_created_at ON public.captures(created_at);
CREATE INDEX IF NOT EXISTS idx_downloads_capture_id ON public.downloads(capture_id);
CREATE INDEX IF NOT EXISTS idx_qr_shares_capture_id ON public.qr_shares(capture_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_shares ENABLE ROW LEVEL SECURITY;

-- 1. PUBLIC WRITE ACCESS (For capturing telemetry and user events)
CREATE POLICY "Allow public inserts to visitors" 
  ON public.visitors FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public inserts to sessions" 
  ON public.sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public updates to sessions" 
  ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public inserts to captures" 
  ON public.captures FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public inserts to downloads" 
  ON public.downloads FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public inserts to qr_shares" 
  ON public.qr_shares FOR INSERT WITH CHECK (true);

-- 2. PUBLIC READ ACCESS
-- Allow visitors to access captures for the shared link pages
CREATE POLICY "Allow public select access on captures" 
  ON public.captures FOR SELECT USING (true);

-- 3. ADMIN-ONLY RESTRICTIONS
-- Checks if the authenticated user is listed in the `admin_users` whitelist table
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Limit SELECT/UPDATE/DELETE access to Whitelisted Admins for all logs
CREATE POLICY "Admin select visitors" ON public.visitors FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin select sessions" ON public.sessions FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin select captures" ON public.captures FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin select downloads" ON public.downloads FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin select qr_shares" ON public.qr_shares FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin select admin_users" ON public.admin_users FOR SELECT USING (public.is_admin());

-- =========================================================================
-- STORAGE BUCKETS CONFIGURATION INSTRUCTIONS
-- =========================================================================
-- You should create a storage bucket named "photobooth" in your Supabase Dashboard.
-- Configure it to be PUBLIC so that visitors can view their shared captures.
-- Objects inside this bucket should follow this folder structure:
--   * photobooth/photos/
--   * photobooth/gifs/
--   * photobooth/boomerangs/
--   * photobooth/thumbnails/

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Lock, Mail, Shield, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]   = useState('');
  const [password, setPassword]= useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          const res = await fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: data.session.access_token }),
          });
          if (res.ok) {
            const { isAdmin } = await res.json();
            if (isAdmin) router.push('/admin/dashboard');
          }
        } catch (err) {
          console.error('Session verification error:', err);
        }
      }
    };
    check();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr || !data.user || !data.session) throw new Error(authErr?.message || 'Authentication failed');

      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.session.access_token }),
      });

      if (!res.ok) {
        await supabase.auth.signOut();
        throw new Error('Verification failed. Please try again.');
      }

      const { isAdmin } = await res.json();
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Access denied. You are not authorised as an administrator.');
      }

      document.cookie = 'sb-admin-auth=true; path=/; max-age=86400; SameSite=Strict; Secure';
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Back link */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm hover:opacity-75 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo lockup */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--text-primary)' }}
          >
            <Shield size={22} style={{ color: 'var(--bg)' }} />
          </div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
          >
            Admin Portal
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to access photobooth analytics
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Error */}
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg flex items-start gap-2 text-sm"
              style={{
                background: 'rgba(139,59,59,0.08)',
                border: '1px solid rgba(139,59,59,0.2)',
                color: 'var(--error)',
              }}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@smilenest.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
              style={{ justifyContent: 'center' }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Verifying…</>
                : 'Sign In'
              }
            </button>
          </form>

          <p
            className="mt-5 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Access restricted to whitelisted administrators only.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

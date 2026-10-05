'use client';
// src/components/ui/AuthStates.tsx
// Reusable UI states for 401 (Unauthenticated) and 403 (Forbidden) access scenarios.
// Designed with minimal, secure messaging that does not expose system internals.

import Link from 'next/link';
import { Lock, ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface AuthStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionHref?: string;
}

/**
 * 401 Unauthorized State — Not authenticated
 */
export function UnauthorizedState({
  title = 'Please Sign In',
  message = 'You need to be signed in to access this page.',
  actionText = 'Sign In to KIRA',
  actionHref = '/login',
}: AuthStateProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-500/10 flex items-center justify-center text-[rgb(var(--text-secondary))] mb-4">
          <Lock size={28} />
        </div>
        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">
          {title}
        </h2>
        <p className="text-sm text-[rgb(var(--text-muted))] mb-6 leading-relaxed">
          {message}
        </p>
        <Link href={actionHref} className="w-full">
          <Button variant="primary" className="w-full">
            {actionText}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * 403 Forbidden State — Authenticated but lacking permission
 */
export function ForbiddenState({
  title = 'Access Restricted',
  message = "You don't have permission to access this agency module or resource.",
  actionText = 'Return to Dashboard',
  actionHref = '/dashboard',
}: AuthStateProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
          <ShieldX size={28} />
        </div>
        <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] mb-2">
          {title}
        </h2>
        <p className="text-sm text-[rgb(var(--text-muted))] mb-6 leading-relaxed">
          {message}
        </p>
        <Link href={actionHref} className="w-full">
          <Button variant="secondary" className="w-full flex items-center justify-center gap-2">
            <ArrowLeft size={16} />
            {actionText}
          </Button>
        </Link>
      </div>
    </div>
  );
}

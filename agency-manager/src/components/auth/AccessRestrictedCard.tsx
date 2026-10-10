'use client';
// src/components/auth/AccessRestrictedCard.tsx
// Shown when a member tries to access restricted administrative areas:
// (Activity, Infra, Data Health, Platform Audit)

import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Mail } from 'lucide-react';
import { KIRA_OWNER_EMAILS, KIRA_MANAGER_EMAIL } from '@/lib/auth/permissions';

interface AccessRestrictedCardProps {
  featureName: string;
  description?: string;
}

export function AccessRestrictedCard({
  featureName,
  description,
}: AccessRestrictedCardProps) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="card max-w-lg w-full p-6 sm:p-8 text-center flex flex-col items-center shadow-lg border border-red-500/25 bg-[rgb(var(--bg-surface))]">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-4 ring-1 ring-red-500/20">
          <ShieldAlert size={28} />
        </div>

        <h2 className="text-xl font-extrabold text-[rgb(var(--text-primary))] tracking-tight mb-2">
          Access Restricted
        </h2>

        <p className="text-sm text-[rgb(var(--text-secondary))] mb-5 leading-relaxed">
          Members are not permitted to access{' '}
          <span className="font-semibold text-[rgb(var(--text-primary))]">{featureName}</span>.
          {description ? ` ${description}` : ' Only the Owners and Manager can access this resource.'}
        </p>

        {/* Contact Owner / Manager callout box */}
        <div className="w-full p-4 rounded-xl bg-red-500/5 border border-red-500/15 text-left mb-6 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-wider">
            <Mail size={14} />
            <span>Contact KIRA Agency Leadership</span>
          </div>
          <p className="text-xs text-[rgb(var(--text-muted))] leading-normal">
            If you need access to this section, please contact an Owner or Manager of KIRA Agency:
          </p>
          <div className="pt-1 space-y-1.5 text-xs">
            {KIRA_OWNER_EMAILS.map((ownerEmail) => (
              <div key={ownerEmail} className="flex items-center justify-between p-2 rounded-lg bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))]">
                <span className="font-semibold text-[rgb(var(--text-primary))]">Owner</span>
                <a
                  href={`mailto:${ownerEmail}`}
                  className="font-mono text-xs font-medium text-[rgb(var(--primary))] hover:underline"
                >
                  {ownerEmail}
                </a>
              </div>
            ))}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))]">
              <span className="font-semibold text-[rgb(var(--text-primary))]">Manager</span>
              <a
                href={`mailto:${KIRA_MANAGER_EMAIL}`}
                className="font-mono text-xs font-medium text-[rgb(var(--primary))] hover:underline"
              >
                {KIRA_MANAGER_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all"
        >
          <ArrowLeft size={16} />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

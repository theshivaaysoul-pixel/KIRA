'use client';
// src/app/(dashboard)/feed/page.tsx
// Content Feed — standalone page reachable from the sidebar.

import { ContentFeed } from '@/components/dashboard/content-feed';

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-8">
      <ContentFeed />
    </div>
  );
}

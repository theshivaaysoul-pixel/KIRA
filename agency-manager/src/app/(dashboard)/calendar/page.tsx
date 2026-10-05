// src/app/(dashboard)/calendar/page.tsx
// Content Calendar page — Phase 9.

import type { Metadata } from 'next';
import { CalendarView } from '@/components/calendar/CalendarView';

export const metadata: Metadata = {
  title: 'Content Calendar | KIRA Agency Manager',
  description: 'Schedule, manage, and track content publications across all social media accounts.',
};

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      <CalendarView />
    </div>
  );
}

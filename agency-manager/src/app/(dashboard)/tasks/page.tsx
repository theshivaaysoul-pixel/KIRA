import type { Metadata } from 'next';
import { DailyTaskManager } from '@/components/tasks/DailyTaskManager';

export const metadata: Metadata = {
  title: 'Daily Content Targets | KIRA Agency Manager',
  description: 'Manage daily platform-wise content target deliverables and real-time completion progress.',
};

export default function TasksPage() {
  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      <DailyTaskManager />
    </div>
  );
}

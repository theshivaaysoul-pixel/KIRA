'use client';
// src/components/layout/Sidebar.tsx
// Navigation filtered by centralized server-aligned permissions.
// Controlled via SidebarContext with toggle button in Header.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Share2,
  Image,
  Calendar,
  BarChart2,
  CheckSquare,
  UsersRound,
  Activity,
  Settings,
  X,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Server,
  KeyRound,
  LogOut,
} from 'lucide-react';
import type { NavItem } from '@/lib/types';
import type { Permission } from '@/lib/auth/permissions';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { useSidebar } from '@/contexts/SidebarContext';
import { Tooltip } from '@/components/motion';

interface SecureNavItem extends NavItem {
  permission: Permission;
}

const NAV_ITEMS: SecureNavItem[] = [
  { label: 'Dashboard',      href: '/dashboard',             icon: 'LayoutDashboard',  implemented: true,  permission: 'dashboard.read' },
  { label: 'Accounts',       href: '/accounts',              icon: 'Users',            implemented: true,  permission: 'accounts.read' },
  { label: 'Platforms',      href: '/platforms',             icon: 'Share2',           implemented: true,  permission: 'platforms.read' },
  { label: 'Content',        href: '/content',               icon: 'Image',            implemented: true,  permission: 'content.read' },
  { label: 'Calendar',       href: '/calendar',              icon: 'Calendar',         implemented: true,  permission: 'calendar.read' },
  { label: 'Analytics',      href: '/analytics',             icon: 'BarChart2',        implemented: true,  permission: 'analytics.read' },
  { label: 'Tasks',          href: '/tasks',                 icon: 'CheckSquare',      implemented: true,  permission: 'tasks.read' },
  { label: 'Team',           href: '/team',                  icon: 'UsersRound',       implemented: true,  permission: 'team.read' },
  { label: 'Activity',       href: '/activity',              icon: 'Activity',         implemented: true,  permission: 'activity.read' },
  { label: 'Settings',       href: '/settings',              icon: 'Settings',         implemented: true,  permission: 'settings.read' },
  { label: 'Infra',          href: '/admin/infra',           icon: 'Server',           implemented: true,  permission: 'storage.read' },
  { label: 'Data Health',    href: '/admin/data-health',     icon: 'ShieldCheck',      implemented: true,  permission: 'system.admin' },
  { label: 'Platform Audit', href: '/admin/platform-audit',  icon: 'Cpu',              implemented: true,  permission: 'system.admin' },
];

const iconComponents: Record<string, React.FC<{ size?: number }>> = {
  LayoutDashboard,
  Users,
  Share2,
  Image,
  Calendar,
  BarChart2,
  CheckSquare,
  UsersRound,
  Activity,
  Settings,
  ShieldCheck,
  Cpu,
  Server,
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { role, status, hasPermission, loading: permissionLoading } = usePermission();
  const { isOpen, close, isMobile } = useSidebar();

  // Filter navigation items by user's active permissions
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // While loading, show dashboard at minimum
    if (permissionLoading) return item.label === 'Dashboard';
    return hasPermission(item.permission);
  });

  const navContent = (
    <>
      {/* Brand Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:py-5 border-b border-[rgb(var(--border))]">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border border-neutral-800 bg-black shadow-md transition-transform duration-200 hover:scale-105">
            <img src="/logo.png" alt="KIRA Logo" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="text-base sm:text-lg font-extrabold text-[rgb(var(--text-primary))] leading-tight tracking-tight">
              KIRA Agency
            </div>
            <div className="text-xs text-[rgb(var(--text-muted))] font-medium leading-tight mt-0.5">
              Manager
            </div>
          </div>
        </div>

        {/* Mobile close button inside the drawer */}
        <button
          type="button"
          onClick={close}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-subtle))] transition-colors shrink-0 cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {visibleNavItems.map((item) => {
          const Icon = iconComponents[item.icon];
          const isActive = pathname === item.href;

          if (!item.implemented) {
            return (
              <div
                key={item.href}
                className="nav-item disabled"
                title="Coming soon"
              >
                {Icon && <Icon size={16} />}
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] text-[rgb(var(--text-muted))] bg-[rgb(var(--bg-subtle))] px-1.5 py-0.5 rounded-full">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item group relative transition-all duration-200 hover:translate-x-1 ${
                isActive ? 'active font-semibold shadow-sm' : ''
              }`}
              onClick={() => {
                if (isMobile) {
                  close();
                }
              }}
            >
              {Icon && (
                <span className="transition-transform duration-200 group-hover:scale-110 shrink-0 flex items-center justify-center">
                  <Icon size={16} />
                </span>
              )}
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--primary))] shrink-0" />
              )}
            </Link>
          );
        })}

        {/* Leadership Section for Manager and Owner: Access Control */}
        {(role === 'OWNER' || role === 'MANAGER') && (
          <div className="pt-3 mt-3 border-t border-[rgb(var(--border))] flex flex-col gap-1">
            <div className="px-3 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--primary))] flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[rgb(var(--primary))]" />
                <span>Access Management</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))] border border-[rgb(var(--primary))]/20">
                Owner & Manager
              </span>
            </div>
            <Link
              href="/admin/access-control"
              className={`nav-item group relative transition-all duration-200 hover:translate-x-1 ${
                pathname === '/admin/access-control' ? 'active font-semibold shadow-sm' : ''
              }`}
              onClick={() => {
                if (isMobile) {
                  close();
                }
              }}
            >
              <span className="transition-transform duration-200 group-hover:scale-110 shrink-0 flex items-center justify-center text-[rgb(var(--primary))]">
                <KeyRound size={16} />
              </span>
              <span className="flex-1 truncate">Access Control</span>
              {pathname === '/admin/access-control' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--primary))] shrink-0" />
              )}
            </Link>
          </div>
        )}

        {status && status !== 'ACTIVE' && (
          <div className="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2 text-xs">
            <ShieldAlert size={14} className="shrink-0" />
            <span>Account {status}</span>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-[rgb(var(--border))] p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Avatar src={user?.photoURL} name={user?.displayName ?? user?.email} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">
                {user?.displayName ?? 'User'}
              </p>
              {role && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-secondary))] border border-[rgb(var(--border))]">
                  {role}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[rgb(var(--text-muted))] truncate">
              {user?.email}
            </p>
          </div>
          <Tooltip content="Log out" position="left">
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut();
                  router.replace('/login');
                } catch (err) {
                  console.error('Failed to log out:', err);
                }
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--text-muted))] hover:text-red-500 hover:bg-red-500/10 active:scale-90 transition-all shrink-0 cursor-pointer"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[rgb(var(--border))]/40">
          <ThemeToggle />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={close}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Unified Responsive Sidebar Drawer */}
      <aside
        className={`sidebar flex flex-col ${isOpen ? 'open' : 'closed'}`}
        aria-label="Sidebar navigation"
      >
        {navContent}
      </aside>
    </>
  );
}

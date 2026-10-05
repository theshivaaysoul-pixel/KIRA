// src/app/(auth)/layout.tsx
// Layout for unauthenticated pages (login, etc.)
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

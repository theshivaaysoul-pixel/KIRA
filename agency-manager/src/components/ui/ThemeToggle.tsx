'use client';
// src/components/ui/ThemeToggle.tsx
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    const handle = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(handle);
  }, []);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-8 h-8 flex items-center justify-center rounded-full
                 text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]
                 hover:bg-[rgb(var(--bg-subtle))]
                 transition-colors duration-150"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

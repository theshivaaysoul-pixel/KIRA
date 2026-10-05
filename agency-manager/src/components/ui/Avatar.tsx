'use client';
// src/components/ui/Avatar.tsx
import { useState, type HTMLAttributes } from 'react';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  xs: { px: 24, text: 'text-[10px]' },
  sm: { px: 32, text: 'text-xs' },
  md: { px: 40, text: 'text-sm' },
  lg: { px: 48, text: 'text-base' },
  xl: { px: 64, text: 'text-lg' },
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ src, name, size = 'md', className = '', ...props }: AvatarProps) {
  const { px, text } = sizeMap[size];
  const [imageError, setImageError] = useState(false);

  const base = [
    'rounded-full shrink-0 overflow-hidden flex items-center justify-center font-semibold select-none',
    `w-[${px}px] h-[${px}px]`,
    className,
  ].join(' ');

  if (src && !imageError) {
    return (
      <div
        className={base}
        style={{ width: px, height: px }}
        {...props}
      >
        <img
          src={src}
          alt={name ?? 'User avatar'}
          width={px}
          height={px}
          className="object-cover w-full h-full"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} bg-gradient-to-br from-violet-500 to-pink-500 text-white ${text}`}
      style={{ width: px, height: px }}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}

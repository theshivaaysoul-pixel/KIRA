'use client';
// src/components/platforms/PlatformIcon.tsx
// Official logo renderer for social platforms using verified high-resolution logos.
// Supports image logos with fallback to safe Lucide icons and stylized letter marks.

import React, { useState } from 'react';
import {
  Camera,
  Video,
  MessageSquare,
  Radio,
  Share2,
  Globe,
  Tv,
  Music,
  Send,
  Compass,
  PlaySquare,
  Users,
  Briefcase,
  Flame,
  Sparkles,
} from 'lucide-react';

export interface PlatformLogoMeta {
  name: string;
  slug: string;
  logo: string;
}

export const PLATFORM_LOGOS: Record<string, PlatformLogoMeta> = {
  facebook: { name: 'Facebook', slug: 'facebook', logo: '/logos/Facebook.png' },
  instagram: { name: 'Instagram', slug: 'instagram', logo: '/logos/Instagram.png' },
  kick: { name: 'Kick', slug: 'kick', logo: '/logos/KICK.png' },
  snapchat: { name: 'Snapchat', slug: 'snapchat', logo: '/logos/Snapchat.png' },
  threads: { name: 'Threads', slug: 'threads', logo: '/logos/Threads.png' },
  tiktok: { name: 'TikTok', slug: 'tiktok', logo: '/logos/Tiktok.png' },
  x: { name: 'X', slug: 'x', logo: '/logos/X.png' },
  twitter: { name: 'X', slug: 'x', logo: '/logos/X.png' },
  youtube: { name: 'YouTube', slug: 'youtube', logo: '/logos/Youtube.png' },
};

/**
 * Resolves a platform name, slug, or icon path to the official high-res logo in /logos.
 * Always prioritizes the platform name/slug to guarantee correct branded assets.
 */
export function resolvePlatformLogo(icon?: string, name?: string, platformName?: string): string | null {
  const candidates = [name, platformName, icon].filter((c): c is string => Boolean(c && typeof c === 'string'));

  for (const raw of candidates) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;

    // 1. Direct key match (e.g. "instagram", "facebook", "tiktok", "x", "youtube", "kick", "snapchat", "threads")
    if (PLATFORM_LOGOS[term]) {
      return PLATFORM_LOGOS[term].logo;
    }

    // 2. Slug or name match
    for (const [key, meta] of Object.entries(PLATFORM_LOGOS)) {
      if (
        term === key ||
        term === meta.slug ||
        term === meta.name.toLowerCase()
      ) {
        return meta.logo;
      }
    }

    // 3. Substring match (e.g. "x (twitter)", "youtube shorts", "/logos/instagram.jpg")
    for (const [key, meta] of Object.entries(PLATFORM_LOGOS)) {
      if (
        term.includes(key) ||
        term.includes(meta.slug) ||
        term.includes(meta.name.toLowerCase())
      ) {
        return meta.logo;
      }
    }
  }

  // 4. If icon is an explicit valid URL or path
  if (icon && typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http'))) {
    // If it points to an old extension like .jpg / .webp / .avif, normalize to .png
    const clean = icon.replace(/\.(jpg|jpeg|webp|avif)$/i, '.png');
    const lower = clean.toLowerCase();
    for (const meta of Object.values(PLATFORM_LOGOS)) {
      if (lower.includes(meta.slug) || lower.includes(meta.name.toLowerCase())) {
        return meta.logo;
      }
    }
    return clean;
  }

  return null;
}

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  instagram: Camera,
  camera: Camera,
  tiktok: Video,
  video: Video,
  x: Send,
  twitter: Send,
  youtube: PlaySquare,
  playsquare: PlaySquare,
  facebook: Users,
  users: Users,
  discord: MessageSquare,
  messagesquare: MessageSquare,
  kick: Radio,
  radio: Radio,
  snapchat: Sparkles,
  sparkles: Sparkles,
  share: Share2,
  share2: Share2,
  globe: Globe,
  tv: Tv,
  music: Music,
  telegram: Send,
  send: Send,
  linkedin: Briefcase,
  briefcase: Briefcase,
  threads: Compass,
  compass: Compass,
  flame: Flame,
};

interface PlatformIconProps {
  icon?: string;
  name?: string;
  platformName?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PlatformIcon({
  icon = '',
  name = '',
  platformName = '',
  size = 20,
  className = '',
  style,
}: PlatformIconProps) {
  const [hasError, setHasError] = useState(false);
  const displayName = name || platformName || '';
  const logoUrl = resolvePlatformLogo(icon, name, platformName);

  if (logoUrl && !hasError) {
    const widthStyle = style?.width ?? `${size}px`;
    const heightStyle = style?.height ?? `${size}px`;

    return (
      <img
        src={logoUrl}
        alt={displayName || 'Platform logo'}
        width={size}
        height={size}
        className={`inline-block object-contain flex-shrink-0 select-none ${className}`}
        style={{ width: widthStyle, height: heightStyle, ...style }}
        onError={() => setHasError(true)}
      />
    );
  }

  // Safe fallback to Lucide icon or letter mark
  const normalizedKey = (icon || displayName).trim().toLowerCase();
  const IconComponent = ICON_MAP[normalizedKey];

  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }

  // Typographic letter mark fallback
  const initial = (displayName || icon || 'P').charAt(0).toUpperCase();
  return (
    <span
      className={`inline-flex items-center justify-center font-bold tracking-tight font-mono select-none ${className}`}
      style={{ fontSize: `${Math.max(10, Math.floor(size * 0.65))}px`, ...style }}
      aria-label={displayName || 'Platform icon'}
    >
      {initial}
    </span>
  );
}

export const AVAILABLE_PLATFORM_ICONS = [
  { key: '/logos/Facebook.png', label: 'Facebook', icon: Users },
  { key: '/logos/Instagram.png', label: 'Instagram', icon: Camera },
  { key: '/logos/KICK.png', label: 'Kick', icon: Radio },
  { key: '/logos/Snapchat.png', label: 'Snapchat', icon: Sparkles },
  { key: '/logos/Threads.png', label: 'Threads', icon: Compass },
  { key: '/logos/Tiktok.png', label: 'TikTok', icon: Video },
  { key: '/logos/X.png', label: 'X', icon: Send },
  { key: '/logos/Youtube.png', label: 'YouTube', icon: PlaySquare },
];

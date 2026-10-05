'use client';
// src/components/dashboard/content-feed/ContentFeedVideo.tsx
// High-performance video player for vertical content feed:
// - Viewport-aware autoplay/pause with coordinated playback manager
// - Muted autoplay compliant with browser media policies
// - Custom sleek overlay controls: Play/Pause, Mute/Unmute, Scrubber, Fullscreen
// - Memory-conscious: pauses immediately when scrolled out of view

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import type { ContentAsset } from '@/lib/types/domain';

interface ContentFeedVideoProps {
  contentId: string;
  asset: ContentAsset;
  isActive: boolean;
  isDeleted?: boolean;
  onVisibilityChange: (contentId: string, isVisible: boolean) => void;
}

export function ContentFeedVideo({
  contentId,
  asset,
  isActive,
  isDeleted = false,
  onVisibilityChange,
}: ContentFeedVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Viewport Observation via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // > 60% visible: candidate to play
        // < 40% visible: pause
        if (entry.intersectionRatio >= 0.6) {
          onVisibilityChange(contentId, true);
        } else if (entry.intersectionRatio <= 0.4) {
          onVisibilityChange(contentId, false);
        }
      },
      {
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [contentId, onVisibilityChange]);

  // 2. Coordinated Play/Pause from isActive prop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && !isDeleted) {
      video.muted = isMuted;
      video
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Browser may block unmuted autoplay; ensure muted and retry safely
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive, isDeleted, isMuted]);

  // Handle controls auto-hide
  const triggerControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2800);
  }, []);

  // Time formatting (mm:ss)
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Video event handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.duration) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoading(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const newPercent = parseFloat(e.target.value);
    const newTime = (newPercent / 100) * duration;
    video.currentTime = newTime;
    setProgress(newPercent);
    setCurrentTime(newTime);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    setHasInteracted(true);
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    triggerControls();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    triggerControls();
  };

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (fsErr) {
      console.warn('[ContentFeedVideo] Fullscreen request error:', fsErr);
    }
  };

  const videoSrc = `/api/content/${contentId}/assets/${asset.id}/file`;

  return (
    <div
      ref={containerRef}
      onMouseMove={triggerControls}
      onClick={togglePlay}
      className="relative w-full h-full min-h-[220px] bg-black flex items-center justify-center overflow-hidden cursor-pointer select-none group"
    >
      {/* HTML5 Native Video Stream */}
      <video
        ref={videoRef}
        src={videoSrc}
        muted={isMuted}
        playsInline
        preload="metadata"
        loop
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-contain pointer-events-none"
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10">
          <Loader2 size={32} className="animate-spin text-white/80" />
        </div>
      )}

      {/* Center Play/Pause Indicator on manual pause */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none z-10 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl scale-100 transition-transform">
            <Play size={24} className="ml-1" />
          </div>
        </div>
      )}

      {/* Floating Bottom Minimalist Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Progress Scrubber */}
        <div className="flex items-center gap-2 mb-2">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            aria-label="Video scrubber"
            className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-[rgb(var(--primary))] hover:h-1.5 transition-all"
          />
        </div>

        {/* Buttons & Counters Row */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white flex items-center gap-1"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {isMuted && !hasInteracted && (
                <span className="text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white/90">
                  Tap to sound
                </span>
              )}
            </button>

            <span className="text-[11px] font-mono text-white/80">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors text-white"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

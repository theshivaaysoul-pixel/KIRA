'use client';
// src/components/layout/GlobalSearch.tsx
// Phase 17 — Global Search Component
//
// Keyboard-friendly live search modal & dropdown in KIRA header:
// - Debounced API calls (250ms)
// - Grouped by entity type (Content, Tasks, Accounts, Team, Platforms, etc.)
// - Arrow key navigation & Enter to visit
// - Honest empty state ("No results found") — NO fake results
// - Dismissible with Escape or click outside

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  X,
  Loader2,
  FileText,
  CheckSquare,
  Users,
  Share2,
  UsersRound,
  Activity,
  Layers,
  CornerDownLeft,
} from 'lucide-react';
import type { SearchResultItem, GroupedSearchResults } from '@/lib/services/global-search-service';

export function GlobalSearch() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [grouped, setGrouped] = useState<GroupedSearchResults>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Global keyboard shortcut to focus search: Ctrl+K or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) && target !== inputRef.current) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === '/' && target !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Perform debounced search
  const performSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setGrouped({});
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = await getIdToken();
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=30`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Search failed with status ${res.status}`);
        }

        const json = await res.json();
        setResults(json.data.results || []);
        setGrouped(json.data.grouped || {});
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search error occurred');
        setResults([]);
        setGrouped({});
      } finally {
        setLoading(false);
      }
    },
    [getIdToken]
  );

  const handleInputChange = (val: string) => {
    setQuery(val);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setResults([]);
      setGrouped({});
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 250);
  };

  const handleSelectResult = (item: SearchResultItem) => {
    setIsOpen(false);
    setQuery('');
    router.push(item.url);
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < results.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'platform':
        return <Share2 size={13} className="text-purple-400" />;
      case 'account':
        return <Users size={13} className="text-blue-400" />;
      case 'content':
        return <FileText size={13} className="text-emerald-400" />;
      case 'task':
        return <CheckSquare size={13} className="text-amber-400" />;
      case 'team':
        return <UsersRound size={13} className="text-cyan-400" />;
      case 'publication':
        return <Layers size={13} className="text-rose-400" />;
      case 'activity':
        return <Activity size={13} className="text-orange-400" />;
      default:
        return <Search size={13} className="text-[rgb(var(--text-muted))]" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[rgb(var(--text-muted))]">
          <Search size={15} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full h-9 pl-10 pr-8 text-xs rounded-xl border border-[rgb(var(--border))]
                     bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))]
                     focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))]/25 focus:border-[rgb(var(--primary))]
                     transition-all duration-200 focus:shadow-sm"
        />
        {loading && (
          <div className="absolute right-2.5 flex items-center pointer-events-none">
            <Loader2 size={13} className="animate-spin text-[rgb(var(--primary))]" />
          </div>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              setResults([]);
              setGrouped({});
              setIsOpen(false);
            }}
            className="absolute right-2.5 p-0.5 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] transition-transform active:scale-90"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dropdown Results Overlay */}
      {isOpen && query.trim() !== '' && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border border-[rgb(var(--border))]
                     bg-[rgb(var(--card))] shadow-2xl backdrop-blur-xl overflow-hidden max-h-[70vh] flex flex-col modal-animate"
        >
          {loading && results.length === 0 ? (
            <div className="p-6 text-center text-xs text-[rgb(var(--text-muted))] flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-[rgb(var(--primary))]" />
              Searching real entities…
            </div>
          ) : error ? (
            <div className="p-4 text-xs text-red-400 bg-red-500/5 text-center">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center space-y-1">
              <p className="text-xs font-semibold text-[rgb(var(--text-primary))]">No results found</p>
              <p className="text-[11px] text-[rgb(var(--text-muted))]">
                No matching platforms, accounts, content, tasks, or team members found for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-[rgb(var(--border))]">
              {/* Grouped results sections */}
              {(
                [
                  { key: 'content', label: 'Content' },
                  { key: 'tasks', label: 'Tasks' },
                  { key: 'accounts', label: 'Social Accounts' },
                  { key: 'platforms', label: 'Platforms' },
                  { key: 'team', label: 'Team Members' },
                  { key: 'publications', label: 'Publications' },
                  { key: 'activity', label: 'Activity Logs' },
                ] as const
              ).map(({ key, label }) => {
                const groupItems = grouped[key];
                if (!groupItems || groupItems.length === 0) return null;

                return (
                  <div key={key} className="p-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-[rgb(var(--text-muted))] uppercase tracking-wider">
                      {label} ({groupItems.length})
                    </div>
                    <div className="space-y-0.5">
                      {groupItems.map((item) => {
                        const itemGlobalIndex = results.findIndex((r) => r.id === item.id);
                        const isSelected = itemGlobalIndex === selectedIndex;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectResult(item)}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2 text-xs
                              ${
                                isSelected
                                  ? 'bg-[rgb(var(--primary))]/10 border border-[rgb(var(--primary))]/30 text-[rgb(var(--text-primary))]'
                                  : 'hover:bg-[rgb(var(--bg-subtle))] text-[rgb(var(--text-primary))] border border-transparent'
                              }`}
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <span className="mt-0.5 shrink-0">{getEntityIcon(item.type)}</span>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate leading-snug">{item.title}</div>
                                {item.subtitle && (
                                  <div className="text-[11px] text-[rgb(var(--text-muted))] truncate leading-snug">
                                    {item.subtitle}
                                  </div>
                                )}
                                {item.snippet && (
                                  <div className="text-[10px] text-[rgb(var(--text-muted))] line-clamp-1 mt-0.5">
                                    {item.snippet}
                                  </div>
                                )}
                              </div>
                            </div>

                            {isSelected && (
                              <CornerDownLeft
                                size={12}
                                className="text-[rgb(var(--primary))] shrink-0 mt-1"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer info bar */}
          {results.length > 0 && (
            <div className="px-3 py-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-subtle))] flex items-center justify-between text-[10px] text-[rgb(var(--text-muted))]">
              <span>{results.length} result(s)</span>
              <div className="flex items-center gap-2">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

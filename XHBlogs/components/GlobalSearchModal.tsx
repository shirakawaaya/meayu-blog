"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscapeClose } from '../lib/use-escape-close';

type ChatterItem = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
};

type MomentItem = {
  id: string;
  date: string;
  content: string;
  location?: string;
};

type SearchResultItem =
  | { type: 'chatter'; item: ChatterItem; url: string; title: string; subtitle: string; date: string }
  | { type: 'moment'; item: MomentItem; url: string; title: string; subtitle: string; date: string };

export default function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [chatters, setChatters] = useState<ChatterItem[]>([]);
  const [moments, setMoments] = useState<MomentItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 快捷键 Ctrl+K / Cmd+K 监听与自定义事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-global-search', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-global-search', handleCustomOpen);
    };
  }, []);

  // 打开时重置查询：用渲染期调整（React 官方推荐写法），不在 effect 里同步 setState
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  // 延迟加载搜索索引数据（首次打开时加载）+ 打开后聚焦输入框
  useEffect(() => {
    if (isOpen && !hasLoaded) {
      fetch('/api/search')
        .then((res) => res.json())
        .then((data) => {
          if (data.chatters) setChatters(data.chatters);
          if (data.moments) setMoments(data.moments);
          setHasLoaded(true);
        })
        .catch((err) => console.error('加载搜索数据失败:', err));
    }
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasLoaded]);

  // Esc 关闭
  useEscapeClose(isOpen, () => setIsOpen(false));

  // 搜索匹配过滤
  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const chatterMatches: SearchResultItem[] = chatters
      .filter((c) => {
        return (
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .map((c) => ({
        type: 'chatter',
        item: c,
        url: `/chatter/${c.slug}`,
        title: c.title,
        subtitle: c.description || (c.tags.length > 0 ? `标签：${c.tags.join('、')}` : ''),
        date: c.date ? c.date.split(' ')[0] : '',
      }));

    const momentMatches: SearchResultItem[] = moments
      .filter((m) => {
        return (
          m.content.toLowerCase().includes(q) ||
          (m.location && m.location.toLowerCase().includes(q))
        );
      })
      .map((m) => ({
        type: 'moment',
        item: m,
        url: `/moments#${m.id}`,
        title: m.content.slice(0, 40) + (m.content.length > 40 ? '…' : ''),
        subtitle: m.location ? `地点：${m.location}` : '短动态',
        date: m.date ? m.date.split(' ')[0] : '',
      }));

    return [...chatterMatches, ...momentMatches].slice(0, 20);
  }, [query, chatters, moments]);

  // 键盘上下键切换结果与回车确认
  const handleKeyNavigation = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = results[selectedIndex];
      if (current) {
        setIsOpen(false);
        router.push(current.url);
      }
    }
  };

  // 滚动跟随
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // 空态推荐：按出现频次取热门标签，最近杂谈按日期倒序取三篇
  const hotTags = useMemo(() => {
    const counts = new Map<string, number>();
    chatters.forEach((c) => c.tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [chatters]);

  const recentChatters = useMemo(
    () => [...chatters].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [chatters],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center pt-20 sm:pt-28 px-4">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-[color-mix(in_oklab,var(--paper-deep)_65%,transparent)] dark:bg-[color-mix(in_oklab,#000_70%,transparent)] backdrop-blur-sm"
          />

          {/* 搜索面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="relative w-full max-w-2xl paper-card-strong rounded-2xl shadow-2xl border border-[var(--card-border)] overflow-hidden z-10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部搜索框 */}
            <div className="flex items-center px-4 sm:px-6 py-4 border-b border-[var(--rule)] gap-3">
              <svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyNavigation}
                placeholder="搜索全站杂谈长文、说说短动态…"
                className="w-full bg-transparent text-base sm:text-lg text-[var(--ink)] placeholder-[var(--ink-faint)] focus:outline-none font-medium"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--rule)] transition-colors text-xs"
                title="关闭 (Esc)" aria-label="关闭搜索"
              >
                ESC
              </button>
            </div>

            {/* 结果列表区 */}
            <div ref={listRef} className="max-h-[380px] overflow-y-auto custom-scrollbar p-2">
              {query.trim() === '' ? (
                <div className="px-3 py-6">
                  {hotTags.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-2.5 text-[11px] font-bold tracking-widest text-[var(--ink-faint)]">热门标签 · Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {hotTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setQuery(tag)}
                            className="rounded-full border border-[var(--card-border)] bg-[var(--paper-deep)] px-3 py-1 text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {recentChatters.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold tracking-widest text-[var(--ink-faint)]">最近杂谈 · Recent</p>
                      {recentChatters.map((c) => (
                        <button
                          key={c.slug}
                          onClick={() => {
                            setIsOpen(false);
                            router.push(`/chatter/${c.slug}`);
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--paper-deep)]"
                        >
                          <span className="truncate text-sm text-[var(--ink)]">{c.title}</span>
                          <span className="shrink-0 text-xs text-[var(--ink-faint)]">{c.date.slice(0, 10)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {hotTags.length === 0 && recentChatters.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-[var(--ink-faint)]">
                      <span>输入关键词，支持搜索标题、正文、标签与地点</span>
                      <div className="flex gap-2 text-xs opacity-75">
                        <span className="rounded border border-[var(--card-border)] bg-[var(--paper-deep)] px-2 py-0.5">杂谈长文</span>
                        <span className="rounded border border-[var(--card-border)] bg-[var(--paper-deep)] px-2 py-0.5">说说动态</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--ink-faint)]">
                  没有找到与“<span className="text-[var(--accent)]">{query}</span>”相关的内容
                </div>
              ) : (
                results.map((res, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={`${res.type}-${res.url}`}
                      onClick={() => {
                        setIsOpen(false);
                        router.push(res.url);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-start justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[color-mix(in_oklab,var(--accent)_10%,var(--paper))] border-l-4 border-l-[var(--accent)] pl-2'
                          : 'hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              res.type === 'chatter'
                                ? 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent)] border border-[color-mix(in_oklab,var(--accent)_20%,transparent)]'
                                : 'bg-[color-mix(in_oklab,var(--ok)_12%,var(--paper))] text-[var(--ok)] border border-[var(--ok)]/20'
                            }`}
                          >
                            {res.type === 'chatter' ? '杂谈' : '说说'}
                          </span>
                          <h4 className="text-sm font-bold text-[var(--ink)] truncate">{res.title}</h4>
                        </div>
                        {res.subtitle && (
                          <p className="text-xs text-[var(--ink-soft)] line-clamp-1">{res.subtitle}</p>
                        )}
                      </div>
                      {res.date && (
                        <span className="text-[10px] font-mono text-[var(--ink-faint)] shrink-0 mt-0.5">{res.date}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 底部导航提示 */}
            <div className="px-4 py-2.5 bg-[var(--paper-deep)] border-t border-[var(--rule)] flex items-center justify-between text-[11px] text-[var(--ink-faint)]">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--paper)] border border-[var(--card-border)] text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-[var(--paper)] border border-[var(--card-border)] text-[10px]">↓</kbd> 切换</span>
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--paper)] border border-[var(--card-border)] text-[10px]">↵</kbd> 打开</span>
              </div>
              <div className="flex items-center gap-1">
                <span>共 {results.length} 条匹配</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

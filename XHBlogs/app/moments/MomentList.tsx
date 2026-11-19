"use client";

import type { MomentListItem } from '../../lib/content-types';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MapPin, Clock, Sparkles, Search, ArrowDownAZ, ArrowUpZA, ChevronLeft, ChevronRight, Ghost, X } from 'lucide-react';
import { useEscapeClose } from '../../lib/use-escape-close';

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  // 历史数据里存在 ISO UTC 串，解析失败或未来时间时直接原样返回，避免显示「-1 天前」
  if (Number.isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 0) return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  if (diffInSeconds < 60) return '刚刚';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小时前`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export default function MomentList({ moments, authorName, avatarUrl }: { moments: MomentListItem[]; authorName: string; avatarUrl: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [lightbox, setLightbox] = useState<{ images: string[], index: number } | null>(null);

  const [selectedYear, setSelectedYear] = useState<string>('全部');
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  const availableYears = useMemo(() => {
    if (!moments) return [];
    const set = new Set<string>();
    moments.forEach((m) => {
      if (m.date) {
        const y = String(m.date).slice(0, 4);
        if (/^\d{4}$/.test(y)) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [moments]);

  const availableLocations = useMemo(() => {
    if (!moments) return [];
    const counts: Record<string, number> = {};
    moments.forEach((m) => {
      const loc = (m.location || '').trim();
      if (loc) {
        counts[loc] = (counts[loc] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([loc, count]) => ({ location: loc, count }));
  }, [moments]);

  const processedMoments = useMemo(() => {
    let result = moments ? [...moments] : [];

    if (selectedYear !== '全部') {
      result = result.filter(m => (m.date || '').startsWith(selectedYear));
    }

    if (selectedLocation) {
      result = result.filter(m => (m.location || '').trim() === selectedLocation);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(m =>
        (m.content || '').toLowerCase().includes(query) ||
        (m.location || '').toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return result;
  }, [moments, searchQuery, sortOrder, selectedYear, selectedLocation]);

  // 灯箱支持 Esc 关闭（此前只能点背景退出）
  useEscapeClose(!!lightbox, () => setLightbox(null));

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.images.length });
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lightbox) return;
    setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length });
  };

  const renderImages = (images: string[]) => {
    if (!images || images.length === 0) return null;
    const count = images.length;

    if (count === 1) {
      return (
        <div className="mt-4 md:mt-8 flex justify-start sm:justify-center w-full">
          <div onClick={() => setLightbox({ images, index: 0 })} className="max-w-[80%] sm:max-w-[280px] overflow-hidden rounded-xl md:rounded-2xl border border-slate-200/50 shadow-lg md:shadow-xl cursor-zoom-in group">
            <img loading="lazy" decoding="async" src={images[0]} alt="moment" className="w-full h-auto max-h-[300px] md:max-h-[400px] object-contain group-hover:scale-105 transition-transform duration-500" />
          </div>
        </div>
      );
    }

    const columns = count === 4 ? 2 : 3;
    const maxWidth = count === 4 ? '210px' : '320px';

    return (
      <div className="w-full flex justify-start sm:justify-center mt-4 md:mt-8">
        <div className="grid gap-1.5 md:gap-2 sm:mx-auto" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, width: '100%', maxWidth: maxWidth }}>
          {images.slice(0, 9).map((src, idx) => {
            const isLastVisible = idx === 8 && count > 9;
            return (
              <div key={idx} onClick={() => setLightbox({ images, index: idx })} className="group relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-slate-200/20 dark:bg-slate-700/20 border border-slate-200/50 cursor-zoom-in">
                <img loading="lazy" decoding="async" src={src} alt="moment" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                {isLastVisible && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <span className="text-lg md:text-xl font-black">+{count - 9}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMomentCard = (moment: MomentListItem, index: number = 0) => {
    return (
      <motion.div
        key={moment.id}
        id={moment.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 100 }}
        className="flex flex-col paper-card rounded-2xl md:rounded-2xl border border-[var(--card-border)] p-5 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-soft)] overflow-hidden relative group w-full"
      >
        <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 pb-4 border-b border-[var(--rule)] relative">
          <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl overflow-hidden shadow-sm border border-[var(--card-border)]">
            {avatarUrl ? <img loading="lazy" decoding="async" src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-[var(--accent)] text-white font-black">{authorName.charAt(0)}</div>}
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm md:text-base font-black text-[var(--accent)] tracking-wide flex items-center gap-1.5">
              <span>{authorName}</span>
              <span className="seal-mark rounded-[1px]" />
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] text-[var(--ink-faint)] font-bold mt-0.5">
              <Clock size={10} className="md:w-3 md:h-3" /> {timeAgo(moment.date)}
            </div>
          </div>
        </div>

        <p className="text-slate-800 dark:text-slate-200 text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium break-words">{moment.content}</p>

        {renderImages(moment.images ?? [])}

        <div className="mt-4 md:mt-6 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            {moment.location && (
              <button
                type="button"
                onClick={() => setSelectedLocation(selectedLocation === moment.location ? '' : (moment.location ?? ''))}
                className={`inline-flex items-center gap-1 text-[9px] md:text-[11px] font-bold px-2.5 py-1 rounded-full transition-all max-w-full truncate border ${
                  selectedLocation === moment.location
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                    : 'bg-[color-mix(in_oklab,var(--ok)_10%,var(--paper))] text-[var(--ok)] border-[var(--ok)]/15 hover:border-[var(--ok)]/40'
                }`}
                title={`按地点「${moment.location}」筛选说说`}
              >
                <MapPin size={10} className="md:w-3 md:h-3 shrink-0" />
                <span className="truncate">{moment.location}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-[95%] md:w-[90%] max-w-6xl mx-auto py-6 md:py-10 mt-24 md:mt-28 relative z-10 flex-1 flex flex-col min-h-[85vh]">

      <div className="mb-8 md:mb-14 text-center relative">
        <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-5xl font-black text-[var(--ink)] mb-2 md:mb-4 tracking-tighter">说说</motion.h1>
        <div className="w-11 h-[3px] bg-[var(--accent)] rounded-full mx-auto mb-3 md:mb-4"></div>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium italic opacity-80 flex items-center justify-center gap-1.5 md:gap-2">
          <Sparkles size={12} className="md:w-3.5 md:h-3.5 text-[var(--accent)]" /> “ 随手记下的日常 ”
        </p>
      </div>

      <div className="mb-10 md:mb-16 flex flex-col items-center gap-5 md:gap-8">
        <div className="relative w-full max-w-lg group px-2 md:px-0">
          <Search className="w-5 h-5 md:w-6 md:h-6 absolute left-6 md:left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--accent)] transition-colors z-20 pointer-events-none" />
          <input type="text" placeholder="搜索说说…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full paper-card border border-[var(--card-border)] rounded-xl md:rounded-2xl px-5 md:px-6 py-3 md:py-4 pl-12 md:pl-14 text-sm md:text-base text-slate-800 dark:text-white shadow-lg md:shadow-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] transition-all font-medium relative z-10" />
        </div>

        <div className="flex paper-card p-1 md:p-1.5 rounded-xl md:rounded-2xl border border-[var(--card-border)] shadow-sm relative z-10">
          <button onClick={() => setSortOrder('desc')} className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all duration-300 ${sortOrder === 'desc' ? 'bg-[var(--accent)] text-white shadow-md md:shadow-lg scale-105' : 'text-slate-500 hover:text-[var(--accent)]'}`}>
            <ArrowDownAZ size={12} className="md:w-3.5 md:h-3.5"/> 最新
          </button>
          <button onClick={() => setSortOrder('asc')} className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all duration-300 ${sortOrder === 'asc' ? 'bg-[var(--accent)] text-white shadow-md md:shadow-lg scale-105' : 'text-slate-500 hover:text-[var(--accent)]'}`}>
            <ArrowUpZA size={12} className="md:w-3.5 md:h-3.5"/> 最早
          </button>
        </div>

        {/* 年份时间轴快捷切换 */}
        {availableYears.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2 px-2 max-w-2xl">
            <button
              onClick={() => setSelectedYear('全部')}
              className={`px-3.5 py-1 md:py-1.5 rounded-xl text-[11px] md:text-xs font-bold transition-all border ${
                selectedYear === '全部'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                  : 'paper-card text-[var(--ink-soft)] border-[var(--card-border)] hover:border-[var(--accent)]'
              }`}
            >
              全部年份
            </button>
            {availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3.5 py-1 md:py-1.5 rounded-xl text-[11px] md:text-xs font-bold transition-all border ${
                  selectedYear === yr
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                    : 'paper-card text-[var(--ink-soft)] border-[var(--card-border)] hover:border-[var(--accent)]'
                }`}
              >
                {yr} 年
              </button>
            ))}
          </div>
        )}

        {/* 足迹地点聚合 */}
        {availableLocations.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 max-w-2xl">
            <span className="text-[11px] font-bold text-[var(--ink-faint)] flex items-center gap-1 mr-1">
              <MapPin size={12} className="text-[var(--accent)]" /> 足迹：
            </span>
            {availableLocations.slice(0, 10).map(loc => (
              <button
                key={loc.location}
                onClick={() => setSelectedLocation(selectedLocation === loc.location ? '' : loc.location)}
                className={`px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-bold transition-all border ${
                  selectedLocation === loc.location
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-[var(--ink-soft)] border-[var(--card-border)] hover:border-[var(--accent)]'
                }`}
              >
                {loc.location} ({loc.count})
              </button>
            ))}
          </div>
        )}

        {/* 生效筛选标签与一键清除 */}
        {(selectedYear !== '全部' || selectedLocation) && (
          <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] border border-[color-mix(in_oklab,var(--accent)_20%,transparent)] px-3.5 py-1.5 rounded-xl">
            <span className="text-[var(--ink-faint)]">当前聚合：</span>
            {selectedYear !== '全部' && <span className="font-bold text-[var(--accent)]">{selectedYear} 年</span>}
            {selectedLocation && <span className="font-bold text-[var(--accent)]">· {selectedLocation}</span>}
            <button
              onClick={() => { setSelectedYear('全部'); setSelectedLocation(''); }}
              className="ml-2 text-[var(--accent)] hover:text-[var(--accent)] hover:underline font-bold flex items-center gap-1"
            >
              <X size={12} /> 清除聚合
            </button>
          </div>
        )}
      </div>

      <LayoutGroup>
        {processedMoments.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-5 md:gap-8 pb-32 w-full items-start">
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              <AnimatePresence mode='popLayout'>
                {processedMoments.filter((_, i) => i % 2 === 0).map((moment, i) => renderMomentCard(moment, i * 2))}
              </AnimatePresence>
            </div>
            <div className="flex-1 flex flex-col gap-5 md:gap-8 w-full min-w-0">
              <AnimatePresence mode='popLayout'>
                {processedMoments.filter((_, i) => i % 2 === 1).map((moment, i) => renderMomentCard(moment, i * 2 + 1))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12 md:py-24 min-h-[300px] md:min-h-[450px]">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center px-6 md:px-10 py-12 md:py-20 paper-card rounded-2xl border border-[var(--card-border)] shadow-lg max-w-lg w-full mx-auto">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] rounded-2xl md:rounded-2xl flex items-center justify-center mb-6 md:mb-8 relative">
                <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--accent)_20%,transparent)] blur-2xl rounded-full animate-pulse"></div>
                <Ghost size={32} className="md:w-12 md:h-12 text-[var(--accent)] relative z-10" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white mb-2 md:mb-4 tracking-tight">{searchQuery ? "没找到相关记忆" : "还没有说说"}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-lg leading-relaxed px-2 md:px-4">{searchQuery ? `换个关键词再试试` : `去写下第一条吧`}</p>
            </motion.div>
          </div>
        )}
      </LayoutGroup>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/98 flex items-center justify-center cursor-pointer overflow-hidden"
            onClick={() => setLightbox(null)}
          >
            {lightbox.images.length > 1 && (
              <>
                <button className="absolute left-4 md:left-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-[var(--card-border)]" onClick={prevImg}><ChevronLeft size={24} className="md:w-9 md:h-9"/></button>
                <button className="absolute right-4 md:right-12 w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-50 border border-[var(--card-border)]" onClick={nextImg}><ChevronRight size={24} className="md:w-9 md:h-9"/></button>
              </>
            )}
            <motion.div key={lightbox.index} initial={{ opacity: 0, scale: 0.9, x: 50 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: -50 }} className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 pointer-events-none">
              <img loading="lazy" decoding="async" src={lightbox.images[lightbox.index]} className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-[var(--card-border)] pointer-events-auto" alt="fullscreen" />
              <div className="absolute bottom-8 md:bottom-10 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 text-white/90 text-[10px] md:text-xs font-black tracking-widest border border-[var(--card-border)]">
                {lightbox.index + 1} / {lightbox.images.length}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
// components/LatestChatterCarousel.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { Link } from 'next-view-transitions';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatterListItem } from '../lib/content-types';

export default function LatestChatterCarousel({ chatters }: { chatters: ChatterListItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (chatters.length <= 1 || paused || manualPause) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setCurrentIndex((prev) => (prev + 1) % chatters.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [chatters.length, paused, manualPause]);

  if (!chatters || chatters.length === 0) return null;

  const currentChatter = chatters[currentIndex];

  const holoVariants = {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.02 },
  };

  return (
    // 注意这里：去掉了 md:col-span-8，变成一个纯粹填满父容器的组件
    <div className="w-full h-full rounded-2xl paper-card border border-[var(--card-border)] overflow-hidden relative group min-h-[220px] flex flex-col transition-all duration-300 hover:-translate-y-1" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) setCurrentIndex((prev) => (prev + (dx < 0 ? 1 : -1) + chatters.length) % chatters.length); touchX.current = null; }}>
      <Link href={currentChatter.slug === 'none' ? '/chatter' : `/chatter/${currentChatter.slug}`} className="absolute inset-0 z-20" aria-label={`查看杂谈：${currentChatter.title}`} />
      <button onClick={(e) => { e.stopPropagation(); setManualPause(v => !v); }} className="absolute top-4 right-4 z-30 w-7 h-7 rounded-full paper-card-strong border border-[var(--card-border)] flex items-center justify-center text-[var(--ink-soft)] hover:text-[var(--accent)] transition-colors" aria-label={manualPause ? "继续轮播" : "暂停轮播"} title={manualPause ? "继续轮播" : "暂停轮播"}>
        {manualPause
          ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>}
      </button>


      <AnimatePresence mode="wait">
        <motion.div
          key={currentChatter.slug}
          variants={holoVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 z-0"
        >
          {currentChatter.cover && <img src={currentChatter.cover} className="vt-chatter-cover w-full h-full object-cover opacity-80 dark:opacity-60 transition-transform duration-1000 group-hover:scale-105" alt="Chatter Cover" />}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10"></div>
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 flex flex-col justify-center p-6 md:p-8 h-full pointer-events-none w-full md:w-[85%]">
        <div className="flex items-end gap-2 mb-2">
          <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest bg-[color-mix(in_oklab,var(--card)_85%,transparent)] px-2.5 py-1 rounded-md border border-[var(--card-border)]">
            杂谈 · Records
          </span>
          {currentChatter.formattedDate && (
            <span className="text-[11px] font-mono text-slate-300 drop-shadow-md">
              {currentChatter.formattedDate.split(' ')[0]}
            </span>
          )}
        </div>

        <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-[var(--accent)] transition-colors line-clamp-1 drop-shadow-md">
          {currentChatter.title}
        </h3>
        <p className="text-sm text-slate-300 font-medium leading-relaxed drop-shadow-md line-clamp-2">
          {currentChatter.description}
        </p>
      </div>

      {chatters.length > 1 && (
        <div className="absolute bottom-5 right-6 z-30 flex gap-2">
          {chatters.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }}
              className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${i === currentIndex ? 'w-6 bg-[var(--accent)]' : 'w-2 bg-white/40 hover:bg-white/80'}`}
              aria-label={`跳到第 ${i + 1} 条`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
"use client";

import { Link } from 'next-view-transitions';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, PanInfo } from 'framer-motion';
import { siteConfig } from '../siteConfig';
import NavThemeSwitch from './NavThemeSwitch';

export default function Navbar() {
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);
  const pathname = usePathname();

  // --- 物理引擎：菜单转动逻辑 ---
  const wheelRef = useRef<HTMLDivElement>(null);
  const rawRotation = useMotionValue(0);
  const smoothRotation = useSpring(rawRotation, { stiffness: 200, damping: 25 });
  const inverseRotation = useTransform(smoothRotation, (r) => -r);

  const handlePan = (event: PointerEvent, info: PanInfo) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currX = info.point.x;
    const currY = info.point.y;
    const prevX = currX - info.delta.x;
    const prevY = currY - info.delta.y;
    const prevAngle = Math.atan2(prevY - centerY, prevX - centerX);
    const currAngle = Math.atan2(currY - centerY, currX - centerX);
    let deltaAngle = (currAngle - prevAngle) * (180 / Math.PI);
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;
    rawRotation.set(rawRotation.get() + deltaAngle);
  };

  // --- 物理引擎：手机端按钮拖拽逻辑 ---
  const dragY = useMotionValue(0);
  const [constraints, setConstraints] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const vh = window.innerHeight;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 约束值依赖挂载后实测的 window.innerHeight
      setConstraints({
        top: -(vh / 2) + 80,
        bottom: (vh / 2) - 80
      });
    }
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) rawRotation.set(0);
  }, [isMobileMenuOpen, rawRotation]);

  // 控制 PC 端导航栏
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const navLinks = [
    { name: '首页', href: '/' },
    { name: '杂谈', href: '/chatter' },
    { name: '说说', href: '/moments' },
    { name: '时间线', href: '/timeline' },
    { name: '照片墙', href: '/photowall' },
    { name: '项目', href: '/projects' },
    { name: '关于', href: '/about' },
  ];

  // 手机端圆盘导航：全部导航项
  const mobileNavLinks = navLinks;

  return (
    <>
      {/* PC端导航栏 */}
      <header className={`hidden md:block w-full fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${showNav ? 'translate-y-0' : '-translate-y-full'} bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] border-[var(--rule)] shadow-sm`}>
        <div className="w-[90%] max-w-6xl mx-auto h-16 flex items-center justify-between px-4 sm:px-[30px] box-border">
          <Link href="/" className="text-xl font-black text-[var(--ink)] tracking-tighter hover:text-[var(--accent)] transition-all duration-300">
            {siteConfig.navTitle || siteConfig.authorName}
            <span className="text-[var(--accent)] mx-1">{siteConfig.navSuffix || 'の'}</span>
            {siteConfig.navAfter || '拾光集'}
          </Link>
          <nav className="flex items-center gap-5 text-sm font-bold">
            {/* PC端依然使用全量的 navLinks */}
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname === `${link.href}/`;
              return (
                <Link key={link.href} href={link.href} className={`relative py-1 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-soft)] hover:text-[var(--accent)]'}`}>
                  {link.name}
                  {isActive && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[var(--accent)] rounded-full animate-pulse"></span>}
                </Link>
              );
            })}
            {/* 全局搜索快捷入口 */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--card)_80%,transparent)] border border-[var(--rule)] transition-all ml-1"
              title="快捷搜索 (Ctrl + K)" aria-label="全局搜索"
            >
              <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[11px] opacity-80">搜索</span>
              <kbd className="hidden lg:inline-block text-[9px] font-mono px-1 py-0.2 bg-[var(--paper-deep)] border border-[var(--card-border)] rounded text-slate-400">⌘K</kbd>
            </button>

            {/* 主题切换：版式 + 明暗 */}
            <span className="ml-1 pl-3 border-l" style={{ borderColor: 'var(--rule)' }}>
              <NavThemeSwitch />
            </span>
          </nav>
        </div>
      </header>

      {/* 手机端：轻量手账式悬浮快捷底栏 (Dock) */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 md:hidden w-[92%] max-w-sm">
        <div className="paper-card-strong border border-[var(--card-border)] rounded-full px-3.5 py-1.5 shadow-xl flex items-center justify-between gap-1">
          {/* 首页 */}
          <Link
            href="/"
            className={`px-3 min-h-[44px] flex items-center rounded-full text-xs font-bold transition-all ${
              pathname === '/' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[var(--accent)]'
            }`}
          >
            首页
          </Link>

          {/* 杂谈 */}
          <Link
            href="/chatter"
            className={`px-3 min-h-[44px] flex items-center rounded-full text-xs font-bold transition-all ${
              pathname.startsWith('/chatter') ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[var(--accent)]'
            }`}
          >
            杂谈
          </Link>

          {/* 说说 */}
          <Link
            href="/moments"
            className={`px-3 min-h-[44px] flex items-center rounded-full text-xs font-bold transition-all ${
              pathname.startsWith('/moments') ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[var(--accent)]'
            }`}
          >
            说说
          </Link>

          {/* 搜索 */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
            className="min-h-[44px] min-w-[44px] rounded-full text-slate-700 dark:text-slate-300 hover:text-[var(--accent)] transition-all flex items-center justify-center"
            title="全站搜索"
            aria-label="全站搜索"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* 罗盘转盘菜单按钮 */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className={`min-h-[44px] px-2.5 rounded-full text-xs font-bold flex items-center gap-1 border transition-all ${
              isMobileMenuOpen
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--paper-deep)] text-[var(--accent)] border-[var(--rule)] hover:scale-105'
            }`}
            title="罗盘转盘"
            aria-label="展开罗盘转盘"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 2 15 12 12 22 9 12" fill="currentColor" opacity="0.7" />
            </svg>
            <span className="text-[10px]">罗盘</span>
          </button>
        </div>
      </div>

      {/* 手机端：可拖拽吸附的右侧触发球 */}
      <div className="md:hidden">
        <motion.button
          drag="y"
          dragConstraints={constraints}
          dragElastic={0.1}
          dragMomentum={false}
          style={{ y: dragY }}
          onClick={() => {
            if (Math.abs(dragY.getVelocity()) < 10) {
              setIsMobileMenuOpen(true);
            }
          }}
          className={`fixed top-1/2 right-0 -translate-y-1/2 w-10 h-24 bg-[var(--accent)] rounded-l-full shadow-md z-[55] flex items-center justify-center transition-all duration-500 border-y border-l border-[var(--card-border)] touch-none ${isMobileMenuOpen ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
          title="展开罗盘"
          aria-label="展开罗盘"
        >
          <div className="flex flex-col gap-1.5 items-center justify-center mr-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </motion.button>

        {/* 2. 居中展开的日晷复古罗盘转轴 */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[65]"
              />

              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(320px,92vw)] h-[min(320px,92vw)] z-[70] pointer-events-none"
              >
                <motion.div
                  ref={wheelRef}
                  style={{ rotate: smoothRotation }}
                  onPan={handlePan}
                  className="w-full h-full rounded-full border-2 border-[var(--rule)] paper-card-strong shadow-2xl pointer-events-auto relative cursor-grab active:cursor-grabbing"
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-[var(--paper-deep)] border-2 border-[var(--rule)] flex items-center justify-center shadow-inner z-10">
                    <button onClick={() => setIsMobileMenuOpen(false)} className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-black shadow-lg hover:rotate-90 transition-all duration-300 active:scale-95" aria-label="关闭罗盘">
                      ✕
                    </button>
                  </div>

                  {/* 手机端轮盘渲染：使用过滤后的 mobileNavLinks */}
                  {mobileNavLinks.map((link, index) => {
                    const isActive = pathname === link.href || pathname === `${link.href}/`;
                    // 角度计算也会基于过滤后的长度，保证图标自动均匀排布！
                    const angle = index * (360 / mobileNavLinks.length);

                    return (
                      <div
                        key={link.href}
                        className="absolute top-1/2 left-1/2 w-14 h-14 -ml-7 -mt-7 flex items-center justify-center"
                        style={{
                          transform: `rotate(${angle}deg) translateY(-115px) rotate(${-angle}deg)`
                        }}
                      >
                        <motion.div style={{ rotate: inverseRotation }} className="w-full h-full">
                          <Link
                            href={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center justify-center w-full h-full rounded-full transition-all duration-300 ${
                              isActive 
                                ? 'bg-[var(--accent)] text-white shadow-md scale-110'
                                : 'paper-card-strong text-[var(--ink)] shadow-md hover:scale-110 border border-[var(--card-border)]'
                            }`}
                          >
                            <span className="text-[11px] font-black">{link.name}</span>
                          </Link>
                        </motion.div>
                      </div>
                    );
                  })}
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
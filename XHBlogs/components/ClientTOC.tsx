"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscapeClose } from '../lib/use-escape-close';

type TocItem = {
  level: number;
  text: string;
  id: string;
};

// 核心增幅：终极 Markdown 净化器！
// 专门用来扒掉诸如 [链接名字](https://...) 的外壳，只留下 "链接名字"
const cleanMarkdownHeading = (rawText: string) => {
  if (!rawText) return '';
  return rawText
    // 1. 提取超链接中的文本内容：[我的标题](https://...) -> 我的标题
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 2. 去除 Markdown 图片：![图片](URL) -> 图片
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 3. 兜底防御：去除可能混入的 HTML 标签
    .replace(/<\/?[^>]+(>|$)/g, '')
    // 4. 去除加粗、斜体、删除线、行内代码符号等
    .replace(/[*_~`#]/g, '')
    .trim();
};

// 底层 ID 净化器
const getSafeId = (rawText: string) => {
  // 先把超链接外壳扒掉，得到纯文本
  const cleanText = cleanMarkdownHeading(rawText);
  // 再杀掉所有标点、空格，只保留汉字、字母和数字生成绝对安全的 ID
  return 'toc-' + cleanText
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase();
};

// 侧边栏视觉净化器
const getDisplayText = (rawText: string) => {
  // 直接调用终极净化器，展示纯洁无瑕的标题名！
  return cleanMarkdownHeading(rawText);
};

export default function ClientTOC({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEscapeClose(isMobileOpen, () => setIsMobileOpen(false));

  useEffect(() => {
    const contentDiv = document.getElementById('article-content');
    if (!contentDiv) return;

    const headings = Array.from(contentDiv.querySelectorAll('h1, h2, h3'));

    // 强制统一正文 ID
    headings.forEach((heading) => {
      // heading.textContent 拿到的是渲染后的纯文字（已经没有超链接语法了）
      // 再过一遍 getSafeId，确保正文和侧边栏的 ID 100% 对齐！
      heading.id = getSafeId(heading.textContent || '');
    });

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const offset = 150;

      let currentActiveId = "";

      for (const heading of headings) {
        const elementTop = heading.getBoundingClientRect().top + scrollY;
        if (scrollY >= elementTop - offset) {
          currentActiveId = heading.id;
        } else {
          break;
        }
      }

      if (currentActiveId) setActiveId(currentActiveId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [toc]);

  const scrollToHeading = (e: React.MouseEvent, id: string) => {
    // 防止任何超链接的意外默认行为
    e.preventDefault();

    const targetElement = document.getElementById(id);
    if (!targetElement) return;

    const offset = 100;
    const targetY = targetElement.getBoundingClientRect().top + window.scrollY - offset;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 600;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number, b: number, c: number, d: number) => {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t * t + b;
      t -= 2;
      return c / 2 * (t * t * t + 2) + b;
    };

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;

      const nextY = easeInOutCubic(timeElapsed, startY, distance, duration);
      window.scrollTo(0, nextY);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        window.scrollTo(0, targetY);
      }
    };

    requestAnimationFrame(animation);
    setActiveId(id);
    setIsMobileOpen(false);
  };

  if (!toc || toc.length === 0) return null;

  return (
    <>
      {/* 桌面端常驻侧栏目录 */}
      <div className="hidden lg:block paper-card rounded-2xl p-6 border border-[var(--card-border)] transition-colors duration-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-4 border-l-4 border-[var(--accent)] pl-2 text-sm uppercase tracking-widest flex items-center gap-2">
          <span>目录</span>
          <span className="text-[10px] text-slate-400 font-normal">TOC</span>
        </h3>
        <nav className="flex flex-col gap-2 relative">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--rule)] rounded-full"></div>

          {toc.map((item, index) => {
            const displayText = getDisplayText(item.text);
            const safeId = getSafeId(item.text);
            const isActive = activeId === safeId;

            return (
              <button
                key={index}
                onClick={(e) => scrollToHeading(e, safeId)}
                className={`text-left text-sm transition-all duration-300 line-clamp-2 cursor-pointer relative pl-4
                  ${item.level === 1 ? 'font-bold mt-2' : ''}
                  ${item.level === 2 ? 'ml-2' : ''}
                  ${item.level === 3 ? 'ml-4 text-xs' : ''}
                  ${isActive ? 'text-[var(--accent)] font-bold scale-105 origin-left' : 'text-slate-600 dark:text-slate-400 hover:text-[var(--accent)]'}
                `}
              >
                {isActive && (
                  <span className="absolute left-[-5px] top-[50%] -translate-y-[50%] w-[6px] h-[6px] rounded-full bg-[var(--accent)] shadow-sm"></span>
                )}
                {displayText}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 移动端悬浮目录按钮（印章小圆纽） */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed bottom-32 right-4 z-40 w-11 h-11 rounded-full paper-card-strong border border-[var(--accent)] text-[var(--accent)] shadow-xl flex items-center justify-center font-bold text-xs tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
          title="展开目录"
          aria-label="展开目录"
        >
          <span className="font-serif text-sm">目</span>
        </button>

        {/* 移动端目录滑出抽屉 */}
        <AnimatePresence>
          {isMobileOpen && (
            <div className="fixed inset-0 z-[80] flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="relative paper-card-strong border-t border-[var(--card-border)] rounded-t-3xl p-6 max-h-[70vh] flex flex-col z-10 shadow-2xl"
              >
                <div className="flex items-center justify-between pb-4 border-b border-[var(--rule)] mb-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span className="seal-mark rounded-[1px]" />
                    <span>文章目录</span>
                  </h3>
                  <button
                    onClick={() => setIsMobileOpen(false)}
                    className="w-7 h-7 rounded-full paper-card flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 py-2 flex flex-col gap-2.5">
                  {toc.map((item, index) => {
                    const displayText = getDisplayText(item.text);
                    const safeId = getSafeId(item.text);
                    const isActive = activeId === safeId;

                    return (
                      <button
                        key={index}
                        onClick={(e) => scrollToHeading(e, safeId)}
                        className={`text-left text-sm transition-colors py-1.5 px-3 rounded-lg line-clamp-2
                          ${item.level === 1 ? 'font-bold' : ''}
                          ${item.level === 2 ? 'pl-5 text-xs' : ''}
                          ${item.level === 3 ? 'pl-8 text-[11px]' : ''}
                          ${isActive ? 'bg-[color-mix(in_oklab,var(--accent)_12%,var(--paper))] text-[var(--accent)] font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-[var(--rule)]'}
                        `}
                      >
                        {displayText}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
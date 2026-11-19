"use client";

import { useEffect, useState } from 'react';
import { useEscapeClose } from '../lib/use-escape-close';

/**
 * 文章正文图片灯箱：挂载后接管 #article-content 内图片的点击，
 * 打开全屏预览，可用按钮/方向键前后切换，Esc 或点击背景关闭。
 */
export default function ArticleImageZoom() {
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null);

  useEscapeClose(!!preview, () => setPreview(null));

  useEffect(() => {
    const rootEl = document.getElementById('article-content');
    if (!rootEl) return;
    const imgs = Array.from(rootEl.querySelectorAll('img'));
    imgs.forEach((img) => {
      img.style.cursor = 'zoom-in';
    });
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'IMG') return;
      const clicked = target as HTMLImageElement;
      const sources = imgs.map((img) => img.currentSrc || img.src).filter(Boolean);
      const index = imgs.indexOf(clicked);
      if (index >= 0 && sources.length > 0) {
        setPreview({ images: sources, index });
      }
    };
    rootEl.addEventListener('click', onClick);
    return () => rootEl.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setPreview((p) => (p ? { ...p, index: (p.index + 1) % p.images.length } : p));
      }
      if (e.key === 'ArrowLeft') {
        setPreview((p) =>
          p ? { ...p, index: (p.index - 1 + p.images.length) % p.images.length } : p,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  if (!preview) return null;

  const step = (delta: number) =>
    setPreview((p) =>
      p
        ? { ...p, index: (p.index + delta + p.images.length) % p.images.length }
        : p,
    );

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={() => setPreview(null)}
      role="dialog"
      aria-modal="true"
      aria-label="文章图片预览"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 灯箱需展示正文原图，原图来源不限域名 */}
      <img
        src={preview.images[preview.index]}
        alt="文章配图预览"
        className="max-h-[86vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      {preview.images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="上一张图片"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="下一张图片"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            →
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {preview.index + 1} / {preview.images.length}
          </span>
        </>
      )}
    </div>
  );
}

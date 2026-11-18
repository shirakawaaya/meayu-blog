"use client";

import { useEffect, useState } from 'react';

export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) {
        setProgress(0);
        return;
      }
      const p = Math.min(100, Math.max(0, (scrollY / scrollHeight) * 100));
      setProgress(p);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] h-[2.5px] pointer-events-none transition-all duration-150 ease-out"
      style={{
        width: `${progress}%`,
        backgroundColor: 'var(--accent)',
        boxShadow: progress > 0 ? '0 0 6px var(--accent-soft)' : 'none',
      }}
    />
  );
}

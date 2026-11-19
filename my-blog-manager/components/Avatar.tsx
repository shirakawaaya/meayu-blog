"use client";

import { useState } from 'react';

/**
 * 头像：R2 大图加载失败时自动回退到姓名首字母块，避免出现裂图。
 * 只负责"图 or 兜底"，尺寸/圆角由外层 className 决定。
 */
export default function Avatar({
  src,
  name,
  className = '',
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--accent)] text-white font-black [container-type:size] ${className}`}
        aria-label={`${name} 的头像`}
      >
        <span className="text-[38cqw] leading-none">{initial}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${name} 的头像`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

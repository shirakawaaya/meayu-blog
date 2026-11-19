"use client";

import { useEffect, useState } from 'react';
import { siteConfig } from '../siteConfig';

/** 页脚运行天数：按 siteConfig.buildDate 在客户端计算，避免静态生成把天数冻在构建那天 */
export default function SiteAge() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const start = new Date(siteConfig.buildDate).getTime();
    if (Number.isNaN(start)) return;
    const diff = Math.floor((Date.now() - start) / 86_400_000);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 天数只能在客户端按本地时间算，属外部状态同步
    setDays(Math.max(diff, 0));
  }, []);

  if (days === null) return null;

  return (
    <p className="text-xs text-[var(--ink-faint)]">
      本站已在纸上安稳运行{' '}
      <span className="font-semibold text-[var(--accent)]">{days}</span> 天
    </p>
  );
}

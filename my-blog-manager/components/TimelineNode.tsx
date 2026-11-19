"use client";

import type { TimelinePost } from '../lib/content-types';
import { motion } from "framer-motion";
import Link from "next/link";

export default function TimelineNode({ post, index }: { post: TimelinePost, index: number }) {
  // 判断是放在左边还是右边（偶数左，奇数右）
  const isLeft = index % 2 === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`mb-12 flex justify-between items-center w-full ${isLeft ? 'md:flex-row-reverse' : 'flex-row'}`}
    >
      {/* 留出对面的一半空白 */}
      <div className="order-1 w-5/12 hidden md:block"></div>

      {/* 中间的圆形节点 */}
      <div className="z-20 flex items-center justify-center order-1 bg-white dark:bg-slate-900 shadow-md w-6 h-6 rounded-full border-4 border-[var(--accent)] ring-4 ring-[var(--accent-soft)] dark:ring-[var(--accent-soft)] transition-colors duration-1000"></div>

      {/* 卡片实体 */}
      <Link href={`/chatter/${post.slug}`} className="order-1 w-full md:w-5/12 group">
        <div className="paper-card rounded-2xl shadow-lg border border-[var(--card-border)] transition-all duration-500 hover:scale-[1.03] hover:paper-card-strong dark:hover:bg-slate-800/70 hover:shadow-2xl overflow-hidden flex flex-col">

          {/* 上半部分：封面图 */}
          <div className="w-full h-40 sm:h-48 overflow-hidden relative bg-slate-200 dark:bg-slate-700">
            <img
              src={post.cover}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
          </div>

          {/* 下半部分：文本信息 */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[var(--accent)] font-bold text-[11px] flex items-center gap-1 uppercase tracking-wider">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {post.type === 'chatter' ? `杂谈 · ${post.date}` : post.date}
              </div>
            </div>

            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-3 group-hover:text-[var(--accent)] transition-colors line-clamp-2 leading-tight">
              {post.title}
            </h3>

            {/* 【核心新增】：文章标签展示 */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent)] dark:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] dark:text-[var(--accent)] border border-[var(--accent-soft)] dark:border-[var(--accent-soft)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 font-medium">
              {post.description}
            </p>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}
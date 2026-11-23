"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { ShieldCheck, Save } from 'lucide-react';

export default function RepoSection() {
  const { showToast } = useToast();
  const [isCheckingPath, setIsCheckingPath] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [blogPath, setBlogPath] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
        const config = await configRes.json();
        const res = await fetch(`http://127.0.0.1:${config.api_port}/api/deploy/config`);
        if (res.ok) {
          const data = await res.json();
          setBlogPath(data.blogPath || "");
          if (data.blogPath) localStorage.setItem('targetBlogPath', data.blogPath);
        }
      } catch (e) {
        // 后端没起来时表单会是空的，容易被误以为「配置丢了」，必须明确提示
        console.error("加载部署配置失败", e);
        showToast("读取博客目录配置失败：后端未启动或端口未就绪，当前显示为空值", "error");
      }
    };
    fetchConfig();
  }, [showToast]);

  const testPathConnection = async () => {
    if (!blogPath) { showToast("请先填写博客目录", "warning"); return; }
    setIsCheckingPath(true);
    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const config = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${config.api_port}/api/deploy/check-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogPath })
      });
      const data = await res.json();
      if (data.success) showToast(data.message, "success");
      else showToast(data.message, "error");
    } catch { showToast("连不上管理端后端", "error"); }
    setIsCheckingPath(false);
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const config = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${config.api_port}/api/deploy/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogPath })
      });
      const data = await res.json();
      if (data.success) showToast(data.message, "success");
    } catch { showToast("保存失败", "error"); }
    setIsSaving(false);
  };

  return (
    <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="paper-card border border-[var(--card-border)] dark:border-[var(--card-border)] rounded-2xl p-8 shadow-lg relative z-10">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-black text-[var(--ink)] dark:text-white flex items-center gap-2">项目仓库设置</h2>
      </div>

      <div className="space-y-8">
        <div className="bg-slate-100/50 dark:bg-white/5 p-5 rounded-2xl border border-[var(--card-border)] dark:border-[var(--card-border)]">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[11px] font-black text-[var(--ink-soft)] dark:text-[var(--ink-soft)] uppercase flex items-center gap-1"><ShieldCheck size={14} className="text-[var(--ink-faint)]" /> 本地博客目录</label>
            <button onClick={testPathConnection} disabled={isCheckingPath} className="text-[10px] paper-card text-[var(--ink-soft)] px-3 py-1 rounded-full font-bold hover:text-[var(--accent)] transition-colors">
              {isCheckingPath ? "探测中…" : "测试路径"}
            </button>
          </div>
          <input type="text" value={blogPath} onChange={e => setBlogPath(e.target.value)} className="w-full paper-card rounded-xl px-4 py-3 text-xs font-mono text-[var(--ink)] outline-none focus:ring-2 focus:ring-[var(--accent-soft)]/40" placeholder="C:/Workspace/XinghuisamaBlogs/XHBlogs" />
          <p className="text-[10px] text-[var(--ink-faint)] mt-2">管理端读写内容均以此目录为准；部署已改为仓库轮询自动构建，无需在此配置部署仓库。</p>
        </div>

        <button onClick={handleSaveConfig} disabled={isSaving} className="ed-btn w-full py-4 text-sm">
          <Save size={18} className="inline mr-2" /> {isSaving ? "正在保存…" : "保存配置（立即生效）"}
        </button>
      </div>
    </motion.section>
  );
}

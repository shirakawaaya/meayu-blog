"use client";

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import RichTextEditor, { RichTextEditorHandle } from '../../components/editor/RichTextEditor';
import MetaMatrix from '../../components/editor/MetaMatrix';
import FloatingImageTool from '../../components/editor/FloatingImageTool';
import { ArrowLeft, AlertTriangle, Save, LogOut, Sparkles, Check, Loader2, RefreshCw, Maximize2, Minimize2, ListTree, PanelRight } from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { useOperations } from '../../context/OperationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useEscapeClose } from '../../lib/use-escape-close';

// 核心修改 1：把原本暴露的主函数改名为 EditorContent（不带 export default）
function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { addOperation } = useOperations();

  const [docType, setDocType] = useState<string>(searchParams.get('type') || 'chatter');
  const [currentDocId, setCurrentDocId] = useState(
    searchParams.get('type') === 'about' ? 'about' : (searchParams.get('id') || 'new')
  );

  // 新建文档先占一个稳定 id：网络卡顿导致重复点发布时，
  // 写的始终是同一个文件，不会生成多份重复内容。
  const [pendingDocId] = useState(() => `${docType}_${Date.now()}${Math.floor(Math.random() * 1000)}`);

  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [cover, setCover] = useState('');
  const [summary, setSummary] = useState('');
  const [mood, setMood] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');

  // 本地实时防丢快照 (Local Real-Time Snapshot)
  const [snapshotAvailable, setSnapshotAvailable] = useState<{
    title: string;
    content: string;
    tags: string[];
    cover: string;
    summary: string;
    mood: string;
    isPrivate: boolean;
    timestamp: number;
    timeStr: string;
  } | null>(null);

  const snapshotKey = useMemo(() => {
    return `editor_snapshot_${docType}_${currentDocId || 'new'}`;
  }, [docType, currentDocId]);

  const [historyPostTags, setHistoryPostTags] = useState<string[]>([]);
  const [historyChatterTags, setHistoryChatterTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const historyMoods = ['开心', '疲惫', '平静', '激动', 'Emo'];

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isImgToolOpen, setIsImgToolOpen] = useState(false);
  const [imgToolTarget, setImgToolTarget] = useState<'editor' | 'cover'>('editor');

  const editorRef = useRef<RichTextEditorHandle>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isMetaOpen, setIsMetaOpen] = useState(true);

  useEscapeClose(isZenMode, () => setIsZenMode(false));

  const getOutlineHeadings = () => {
    const raw = editorRef.current?.getContent() || '';
    const headings: { level: number; text: string }[] = [];
    const htmlRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
    let m;
    while ((m = htmlRegex.exec(raw)) !== null) {
      headings.push({ level: parseInt(m[1]), text: m[2].replace(/<[^>]*>/g, '').trim() });
    }
    if (headings.length === 0) {
      for (const line of raw.split('\n')) {
        const mdM = line.match(/^(#{1,3})\s+(.+)$/);
        if (mdM) headings.push({ level: mdM[1].length, text: mdM[2].trim() });
      }
    }
    return headings;
  };

  const scrollToEditorHeading = (text: string) => {
    const editorDom = document.querySelector('.ProseMirror') || document.querySelector('textarea');
    if (!editorDom) return;
    const elements = Array.from(editorDom.querySelectorAll('h1, h2, h3'));
    for (const el of elements) {
      if ((el.textContent || '').trim().includes(text)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  };

  // AI 润色
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishElapsed, setPolishElapsed] = useState(0);
  const [polishModal, setPolishModal] = useState<{ open: boolean; original: string; polished: string }>({ open: false, original: '', polished: '' });
  // 润色结果可能是 Markdown（提示词可配置），统一走和博客端一致的渲染再预览，
  // 否则 `# 标题`、`**粗体**` 会原样显示成符号
  const [polishPreview, setPolishPreview] = useState({ original: '', polished: '' });

  useEffect(() => {
    if (!polishModal.open) return;
    let cancelled = false;
    const render = async (text: string) => {
      if (!text) return '';
      try {
        const res = await fetch('/api/markdown-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: text }),
        });
        const data = await res.json();
        return data.success ? (data.html || '') : text;
      } catch {
        return text;
      }
    };
    Promise.all([render(polishModal.original), render(polishModal.polished)]).then(([original, polished]) => {
      if (!cancelled) setPolishPreview({ original, polished });
    });
    return () => { cancelled = true; };
  }, [polishModal.open, polishModal.original, polishModal.polished]);

  // 润色要等几秒到几十秒，必须让用户看到"还在跑"，否则会以为按钮没反应
  useEffect(() => {
    if (!isPolishing) { setPolishElapsed(0); return; }
    const start = Date.now();
    setPolishElapsed(0);
    const timer = setInterval(() => setPolishElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(timer);
  }, [isPolishing]);

  const handlePolish = async () => {
    if (isPolishing) return;
    const original = editorRef.current?.getContent() || '';
    if (!original.replace(/<[^>]*>/g, '').trim()) {
      showToast('正文是空的，先写点什么再润色', 'warning');
      return;
    }
    setIsPolishing(true);
    // 模型偶发很慢，加 90 秒硬超时，避免按钮一直转圈却没有任何交代
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: original, mode: 'html' }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.success && data.polished) {
        setPolishModal({ open: true, original, polished: data.polished });
      } else {
        showToast(data.message || '润色失败', 'error');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        showToast('润色超过 90 秒仍未返回，请检查模型配置或网络后重试', 'error');
      } else {
        console.error(e);
        showToast('润色请求失败，请检查网络或模型配置', 'error');
      }
    } finally {
      clearTimeout(timeout);
      setIsPolishing(false);
    }
  };

  const applyPolished = () => {
    editorRef.current?.setContent(polishModal.polished);
    setPolishModal({ open: false, original: '', polished: '' });
    setHasUnsavedChanges(true);
    showToast('已应用润色结果（原文可通过 Ctrl+Z 恢复）', 'success');
  };

  useEffect(() => {
    const fetchTags = async () => {
      setIsLoadingTags(true);
      try {
        const configRes = await fetch(`/backend_config.json`);
        const config = await configRes.json();
        const res = await fetch(`http://127.0.0.1:${config.api_port}/api/drafts/all_tags`);
        const data = await res.json();
        if (data.success) {
          setHistoryPostTags(data.postTags || []);
          setHistoryChatterTags(data.chatterTags || []);
        }
      } catch (err) { console.error(err); }
      finally { setIsLoadingTags(false); }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (currentDocId !== 'new') {
      const loadDraft = async () => {
        try {
          const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
          const config = await configRes.json();

          const res = await fetch(`http://127.0.0.1:${config.api_port}/api/drafts/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentDocId, type: docType })
          });

          const data = await res.json();
          if (data.success) {
            if (data.draft.type) setDocType(data.draft.type);
            setDate(data.draft.date || '');
            setTitle(data.draft.type === 'about' ? '关于我' : (data.draft.title || ''));
            setTags(data.draft.tags || []);
            setCover(data.draft.cover || '');
            setSummary(data.draft.description || '');
            setMood(data.draft.mood || '');
            setIsPrivate(Boolean(data.draft.isPrivate));
            setContent(data.draft.content || '');

            setTimeout(() => setHasUnsavedChanges(false), 500);
            showToast("已读取本地源数据", "success");

            // 检查是否有内容不一致的未保存快照
            try {
              const snapRaw = localStorage.getItem(snapshotKey);
              if (snapRaw) {
                const snap = JSON.parse(snapRaw);
                const serverContent = (data.draft.content || '').replace(/<[^>]*>/g, '').trim();
                const snapContent = (snap.content || '').replace(/<[^>]*>/g, '').trim();
                const isDifferent = snapContent !== serverContent || snap.title !== (data.draft.title || '');
                if (isDifferent && (snapContent || snap.title)) {
                  const d = new Date(snap.timestamp);
                  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                  setSnapshotAvailable({ ...snap, timeStr });
                } else {
                  localStorage.removeItem(snapshotKey);
                  setSnapshotAvailable(null);
                }
              }
            } catch {}
          } else {
             showToast(data.message || "未找到草稿或原文件", "error");
          }
        } catch { showToast("读取失败", "error"); }
      };
      loadDraft();
    } else {
      // 新建文档模式：检查是否存在未保存快照
      try {
        const snapRaw = localStorage.getItem(snapshotKey);
        if (snapRaw) {
          const snap = JSON.parse(snapRaw);
          const snapContent = (snap.content || '').replace(/<[^>]*>/g, '').trim();
          if (snapContent || snap.title) {
            const d = new Date(snap.timestamp);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            setSnapshotAvailable({ ...snap, timeStr });
          }
        }
      } catch {}
    }
  }, [currentDocId, snapshotKey]);

  // 本地实时防丢快照：防误关、防崩溃、防断电（1.5 秒无操作自动静默落盘至 localStorage）
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const timer = setTimeout(() => {
      try {
        const currentContent = editorRef.current?.getContent() || '';
        if (title.trim() || currentContent.replace(/<[^>]*>/g, '').trim()) {
          const snapData = {
            title,
            tags,
            cover,
            summary,
            mood,
            isPrivate,
            content: currentContent,
            timestamp: Date.now(),
          };
          localStorage.setItem(snapshotKey, JSON.stringify(snapData));
        }
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [hasUnsavedChanges, title, tags, cover, summary, mood, isPrivate, snapshotKey]);

  const handleRestoreSnapshot = () => {
    if (!snapshotAvailable) return;
    setTitle(snapshotAvailable.title || '');
    setTags(snapshotAvailable.tags || []);
    setCover(snapshotAvailable.cover || '');
    setSummary(snapshotAvailable.summary || '');
    setMood(snapshotAvailable.mood || '');
    setIsPrivate(Boolean(snapshotAvailable.isPrivate));
    if (editorRef.current) {
      editorRef.current.setContent(snapshotAvailable.content || '');
    }
    setContent(snapshotAvailable.content || '');
    setHasUnsavedChanges(true);
    setSnapshotAvailable(null);
    showToast("已成功恢复本地快照", "success");
  };

  const handleDiscardSnapshot = () => {
    try {
      localStorage.removeItem(snapshotKey);
    } catch {}
    setSnapshotAvailable(null);
    showToast("已放弃本地快照", "info");
  };

  useEffect(() => {
    if (!isLoadingTags) {
      setHasUnsavedChanges(true);
    }
  }, [title, tags, cover, summary, mood, isPrivate]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setExitModalOpen(true);
    } else {
      router.back();
    }
  };

  const handleSave = async (isPublish: boolean, shouldExitAfterSave: boolean = false) => {
    if (!title.trim() && docType !== 'about') {
      showToast("请填写标题", "warning"); return;
    }
    // 发布时若处在 Markdown 源码模式，直接把 md 原文交给后端落盘，
    // 省掉 HTML→Markdown 的二次转换损耗；草稿仍存 HTML，读回编辑器不用猜格式。
    const handle = editorRef.current;
    const isSourceMode = handle?.isSourceMode() ?? false;
    const useMarkdown = isSourceMode && isPublish;
    const payload = {
      id: docType === 'about' ? 'about' : (currentDocId === 'new' ? pendingDocId : currentDocId),
      type: docType, title, tags, cover, mood, description: summary,
      isPrivate,
      content: (useMarkdown ? handle?.getMarkdown() : handle?.getContent()) || '',
      contentFormat: useMarkdown ? 'markdown' : 'html',
      date: date || new Date().toLocaleDateString('sv-SE'),
      published: isPublish
    };

    if (isPublish) {
      addOperation({
        id: `publish_${Date.now()}`,
        type: "publish_article",
        label: `发布: ${title || '无标题'}`,
        value: payload
      });
      setHasUnsavedChanges(false);
      try { localStorage.removeItem(snapshotKey); } catch {}
      setSnapshotAvailable(null);
      showToast("已加入待保存，记得点右上角【保存到博客】；刷新页面会丢失", "info");
      if (shouldExitAfterSave) router.back();
      return;
    }

    setIsSaving(true);
    try {
      const configRes = await fetch(`/backend_config.json`);
      const config = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${config.api_port}/api/drafts/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        // 后端会给新草稿分配 id，必须回写到本地状态：
        // 否则第二次保存仍以 id=null 提交，会再生成一份新草稿（草稿箱出现重复条目），
        // 发布时也因 id 为空找不到草稿文件，导致草稿残留在草稿箱。
        if (data.id && currentDocId === 'new') {
          setCurrentDocId(data.id);
        }
        setLastSaved(new Date().toLocaleTimeString());
        setHasUnsavedChanges(false);
        try { localStorage.removeItem(snapshotKey); } catch {}
        setSnapshotAvailable(null);
        showToast("草稿已保存", "success");
        if (shouldExitAfterSave) {
          setExitModalOpen(false);
          router.back();
        }
      }
    } catch { showToast("保存失败", "error"); }
    finally { setIsSaving(false); }
  };

  // 确认框支持 Esc 关闭
  useEscapeClose(exitModalOpen, () => setExitModalOpen(false));

  return (
    <div className="h-screen w-screen overflow-hidden relative">

      {/* 润色进行中：持续可见的进度提示，避免长时间无反馈被当成"按钮坏了" */}
      <AnimatePresence>
        {isPolishing && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-3.5 rounded-2xl paper-card-strong border border-[var(--card-border)] shadow-lg flex items-center gap-3"
          >
            <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-black text-[var(--ink)]">AI 正在润色…</span>
              <span className="text-[10px] font-bold text-[var(--ink-faint)]">已等待 {polishElapsed}s · 通常 5–20 秒</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exitModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExitModalOpen(false)} className="absolute inset-0 bg-slate-900/40" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm paper-card-strong rounded-2xl shadow-lg border border-[var(--card-border)] p-10 text-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--warn)] to-transparent opacity-60" />
              <div className="w-20 h-20 bg-[color-mix(in_oklab,var(--warn)_12%,transparent)] rounded-2xl flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10 text-[var(--warn)]" /></div>
              <h3 className="text-xl font-black text-[var(--ink)] mb-2">存在未保存的数据</h3>
              <p className="text-sm text-[var(--ink-soft)] font-medium mb-8 leading-relaxed">改动还没有保存，<br />直接离开会丢失本次修改。</p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleSave(false, true)}
                  className="w-full py-4 bg-[var(--accent)] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-[var(--accent)] transition-all flex items-center justify-center gap-2"
                >
                  <Save size={16} /> 存为草稿并离开
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setExitModalOpen(false)} className="flex-1 py-4 bg-[var(--paper-deep)] text-[var(--ink-soft)] rounded-2xl text-xs font-black uppercase tracking-widest hover:text-[var(--ink)] transition-all">取消</button>
                  <button onClick={() => { setExitModalOpen(false); setHasUnsavedChanges(false); router.back(); }} className="flex-1 py-4 bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger)] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[var(--danger)] hover:text-white transition-all flex items-center justify-center gap-2">
                  <LogOut size={16} /> 不保存直接离开
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI 润色预览弹窗 */}
      <AnimatePresence>
        {polishModal.open && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPolishModal({ open: false, original: '', polished: '' })}
              className="absolute inset-0 bg-slate-900/50"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 24 }}
              className="relative w-full max-w-5xl h-[82vh] paper-card-strong rounded-2xl shadow-lg border border-[var(--card-border)] flex flex-col overflow-hidden"
            >
              <div className="shrink-0 px-8 pt-7 pb-5 border-b border-[var(--rule)] flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-[var(--ink)] flex items-center gap-2">
                    <Sparkles size={18} className="text-[var(--accent)]" /> AI 润色预览
                  </h3>
                  <p className="text-xs text-[var(--ink-faint)] mt-1">满意就应用，不满意点丢弃，原文不受影响</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePolish}
                    disabled={isPolishing}
                    className="px-5 py-2.5 paper-card border border-[var(--card-border)] text-[var(--ink-soft)] rounded-xl text-xs font-bold hover:text-[var(--accent)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isPolishing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    重新润色
                  </button>
                  <button
                    onClick={() => setPolishModal({ open: false, original: '', polished: '' })}
                    className="px-5 py-2.5 paper-card border border-[var(--card-border)] text-[var(--ink-soft)] rounded-xl text-xs font-bold hover:text-[var(--ink)] transition-colors"
                  >
                    丢弃
                  </button>
                  <button
                    onClick={applyPolished}
                    className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Check size={14} /> 应用润色
                  </button>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-hidden min-h-0">
                <div className="flex flex-col min-h-0">
                  <p className="text-[11px] font-bold text-[var(--ink-faint)] mb-2">原文</p>
                  <div className="flex-1 overflow-y-auto custom-scrollbar paper-card rounded-2xl p-5 border border-[var(--card-border)]">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: polishPreview.original || polishModal.original }} />
                  </div>
                </div>
                <div className="flex flex-col min-h-0">
                  <p className="text-[11px] font-bold text-[var(--accent)] mb-2">润色后</p>
                  <div className="flex-1 overflow-y-auto custom-scrollbar paper-card rounded-2xl p-5 border border-[var(--accent-soft)]">
                    <div className="prose prose-slate dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: polishPreview.polished || polishModal.polished }} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={hasUnsavedChanges ? "relative z-50 [&_a]:pointer-events-none" : "relative z-50"}>
        {hasUnsavedChanges && (
          <div className="absolute inset-0 z-50 cursor-pointer" onClick={() => setExitModalOpen(true)}></div>
        )}
      </div>

      <div>
        {/* 左右并排；min-w-0 让主区在窄屏可收缩，不会撑开容器 */}
        <main className="mx-auto w-[96%] max-w-[1750px] flex flex-row gap-6 relative min-[1400px]:h-[calc(100vh-144px-32px)]" style={{ marginTop: '144px', marginBottom: '32px' }}>

          <div className="absolute -top-14 left-2 right-2 flex items-center justify-between z-50">
            <button
              onClick={handleBackClick}
              className="px-4 py-2 paper-card border border-[var(--card-border)] rounded-xl shadow-md flex items-center gap-1.5 text-[var(--ink-soft)] font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group"
            >
              <ArrowLeft size={15} className="group-hover:-translate-x-1 transition-transform text-[var(--accent)]" />
              返回上一级
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOutlineOpen(!isOutlineOpen)}
                className={`px-3.5 py-2 paper-card border border-[var(--card-border)] rounded-xl shadow-md flex items-center gap-1.5 text-xs font-bold transition-all ${
                  isOutlineOpen ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--accent)]'
                }`}
                title="切换文章大纲"
              >
                <ListTree size={14} />
                <span>大纲</span>
              </button>

              <button
                onClick={() => setIsMetaOpen(!isMetaOpen)}
                className={`px-3.5 py-2 paper-card border border-[var(--card-border)] rounded-xl shadow-md flex items-center gap-1.5 text-xs font-bold transition-all ${
                  isMetaOpen ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--accent)]'
                }`}
                title="切换右侧信息面板（标签/封面/心情）"
              >
                <PanelRight size={14} />
                <span>信息</span>
              </button>

              <button
                onClick={() => setIsZenMode(true)}
                className="px-3.5 py-2 paper-card border border-[var(--card-border)] rounded-xl shadow-md flex items-center gap-1.5 text-[var(--ink-soft)] hover:text-[var(--accent)] font-bold text-xs transition-all hover:scale-105 active:scale-95"
                title="开启全屏专注书写模式 (Esc 退出)"
              >
                <Maximize2 size={14} />
                <span>专注模式</span>
              </button>
            </div>
          </div>

          <section className="flex-1 min-w-0 paper-card rounded-2xl border border-[var(--card-border)] flex flex-col overflow-hidden min-[1400px]:min-h-0 min-h-[70vh]">
            {/* 本地未保存防丢快照恢复提示 */}
            <AnimatePresence>
              {snapshotAvailable && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 shrink-0"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <span>检测到本地未保存的防丢快照（{snapshotAvailable.timeStr}），是否恢复？</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRestoreSnapshot}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                    >
                      恢复快照
                    </button>
                    <button
                      onClick={handleDiscardSnapshot}
                      className="px-2.5 py-1 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      放弃
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <RichTextEditor
              ref={editorRef}
              title={title}
              setTitle={(val) => { setTitle(val); setHasUnsavedChanges(true); }}
              initialContent={content}
              isTitleLocked={docType === 'about'}
              onOpenImageTool={() => { setImgToolTarget('editor'); setIsImgToolOpen(true); }}
              onPolishClick={handlePolish}
              isPolishing={isPolishing}
              onChange={() => setHasUnsavedChanges(true)}
            />
          </section>

          {/* 实时大纲侧栏 */}
          <AnimatePresence>
            {isOutlineOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="shrink-0 paper-card rounded-2xl border border-[var(--card-border)] p-4 flex flex-col overflow-hidden min-[1400px]:min-h-0"
              >
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--rule)]">
                  <h4 className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <ListTree size={14} className="text-[var(--accent)]" />
                    <span>文章大纲</span>
                  </h4>
                  <button onClick={() => setIsOutlineOpen(false)} className="text-[var(--ink-faint)] hover:text-[var(--ink)] text-xs">✕</button>
                </div>
                <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-1.5 py-1">
                  {getOutlineHeadings().length === 0 ? (
                    <p className="text-[11px] text-[var(--ink-faint)] py-6 text-center leading-relaxed">暂无标题结构<br />使用 H1~H3 组织文章</p>
                  ) : (
                    getOutlineHeadings().map((h, i) => (
                      <button
                        key={i}
                        onClick={() => scrollToEditorHeading(h.text)}
                        className={`text-left text-xs transition-colors py-1.5 px-2 rounded-lg line-clamp-1 hover:bg-[var(--rule)] ${
                          h.level === 1 ? 'font-bold text-[var(--ink)]' : h.level === 2 ? 'pl-4 text-[var(--ink-soft)]' : 'pl-6 text-[11px] text-[var(--ink-faint)]'
                        }`}
                      >
                        {h.text}
                      </button>
                    ))
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isMetaOpen && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="w-[360px] shrink-0 paper-card rounded-2xl border border-[var(--card-border)] flex flex-col overflow-hidden min-[1400px]:min-h-0"
              >
            <MetaMatrix
              type={docType as 'post' | 'chatter' | 'about'} tags={tags} setTags={setTags} cover={cover} setCover={setCover} summary={summary} setSummary={setSummary} mood={mood} setMood={setMood}
              isPrivate={isPrivate} setIsPrivate={(val) => { setIsPrivate(val); setHasUnsavedChanges(true); }}
              allHistoryPostTags={historyPostTags} allHistoryChatterTags={historyChatterTags} isLoadingTags={isLoadingTags}
              allHistoryMoods={historyMoods} onSave={(isPublish) => handleSave(isPublish, false)} isSaving={isSaving} lastSaved={lastSaved} onOpenImageTool={() => { setImgToolTarget('cover'); setIsImgToolOpen(true); }}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* 全屏专注模式 (Zen Mode) */}
      <AnimatePresence>
        {isZenMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-[var(--paper)] flex flex-col p-4 sm:p-8 overflow-y-auto custom-scrollbar"
          >
            <div className="w-full max-w-4xl mx-auto flex items-center justify-between pb-4 border-b border-[var(--rule)] mb-6 shrink-0">
              <div className="flex items-center gap-3 text-xs font-bold text-[var(--ink-soft)]">
                <span className="flex items-center gap-1.5"><span className="seal-mark rounded-[1px]" /> 专注书写中</span>
                <span>约 {content.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length} 字</span>
                {lastSaved && <span className="text-[var(--ink-faint)]">保存于 {lastSaved}</span>}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave(false, false)}
                  disabled={isSaving}
                  className="px-4 py-1.5 paper-card border border-[var(--card-border)] rounded-xl text-xs font-bold text-[var(--ink)] hover:text-[var(--accent)] transition-all flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>存草稿</span>
                </button>
                <button
                  onClick={() => setIsZenMode(false)}
                  className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5"
                  title="退出专注模式 (Esc)"
                >
                  <Minimize2 size={13} />
                  <span>退出专注 (Esc)</span>
                </button>
              </div>
            </div>

            <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col paper-card border border-[var(--card-border)] rounded-2xl shadow-xl overflow-hidden min-h-[80vh]">
              <RichTextEditor
                ref={editorRef}
                title={title}
                setTitle={(val) => { setTitle(val); setHasUnsavedChanges(true); }}
                initialContent={content}
                isTitleLocked={docType === 'about'}
                onOpenImageTool={() => { setImgToolTarget('editor'); setIsImgToolOpen(true); }}
                onPolishClick={handlePolish}
                isPolishing={isPolishing}
                onChange={() => setHasUnsavedChanges(true)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <FloatingImageTool isOpen={isImgToolOpen} onClose={() => setIsImgToolOpen(false)} onInsert={(url) => {
        if (imgToolTarget === 'editor') { editorRef.current?.insertImage(url); if (!cover) setCover(url); }
        else { setCover(url); setIsImgToolOpen(false); }
        setHasUnsavedChanges(true);
      }} />
    </div>
  );
}

// 核心修改 2：在底部暴露真正的 EditorPage，并用 Suspense 把里面的内容套起来
export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[color-mix(in_oklab,var(--accent)_20%,transparent)] border-t-[var(--accent)] rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold tracking-widest text-sm uppercase">编辑器加载中...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
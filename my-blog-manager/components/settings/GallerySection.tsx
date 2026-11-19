import { useEffect, useState } from 'react';
import type { SettingsSectionProps } from './shared';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { Trash2, RefreshCw, CheckCircle2, Loader2, FolderArchive, Cloud, Save, PlugZap } from 'lucide-react';
import { toPreviewSrc } from '../imagePreview';
import { picbedBase, r2ConfigBase } from '../../lib/picbed';

type Orphan = { filename: string; url: string; size: number; mtime: number };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- props 由设置页统一传入，本分区（R2/图库）走独立 API 保存，不经表单队列
export default function GallerySection({ formData, handleUpdate, pushToQueue }: SettingsSectionProps) {
  const { showToast } = useToast();

  // 孤儿图片扫描与清理（本地 + R2）
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    totalCount: number;
    orphanCount: number;
    totalOrphanBytes: number;
    orphans: Orphan[];
    r2TotalCount?: number;
    r2Orphans?: Orphan[];
    r2OrphanBytes?: number;
  } | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleScanOrphans = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const base = await picbedBase();
      const res = await fetch(`${base}/scan_orphans`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setScanResult(data);
        const r2n = data.r2Orphans?.length || 0;
        if (data.orphanCount === 0 && r2n === 0) {
          showToast("扫描完成，所有图片均被正常引用！", "success");
        } else {
          showToast(`扫描发现本地 ${data.orphanCount} 张、R2 ${r2n} 张孤儿图片`, "info");
        }
      } else {
        showToast(data.message || "扫描失败", "error");
      }
    } catch (e) {
      showToast(`扫描请求失败: ${e instanceof Error ? e.message : '未知错误'}`, "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteOrphans = async (filenames: string[]) => {
    if (filenames.length === 0) return;
    if (!window.confirm(`确认彻底从硬盘删除选中的 ${filenames.length} 张废弃图片吗？此操作不可撤回！`)) return;

    setIsCleaning(true);
    try {
      const base = await picbedBase();
      const res = await fetch(`${base}/delete_orphans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "清理成功", "success");
        setScanResult(prev => {
          if (!prev) return null;
          const remaining = prev.orphans.filter(o => !filenames.includes(o.filename));
          return {
            ...prev,
            orphanCount: remaining.length,
            totalOrphanBytes: remaining.reduce((sum, item) => sum + item.size, 0),
            orphans: remaining
          };
        });
      } else {
        showToast(data.message || "删除失败", "error");
      }
    } catch (e) {
      showToast(`删除请求失败: ${e instanceof Error ? e.message : '未知错误'}`, "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteR2Orphans = async (keys: string[]) => {
    if (keys.length === 0) return;
    if (!window.confirm(`确认从 R2 存储桶彻底删除选中的 ${keys.length} 张图片吗？此操作不可撤回！`)) return;

    setIsCleaning(true);
    try {
      const base = await picbedBase();
      const res = await fetch(`${base}/delete_r2_orphans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: keys })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "清理成功", "success");
        setScanResult(prev => {
          if (!prev) return null;
          const remaining = (prev.r2Orphans || []).filter(o => !keys.includes(o.filename));
          return {
            ...prev,
            r2Orphans: remaining,
            r2OrphanBytes: remaining.reduce((sum, item) => sum + item.size, 0)
          };
        });
      } else {
        showToast(data.message || "删除失败", "error");
      }
    } catch (e) {
      showToast(`删除请求失败: ${e instanceof Error ? e.message : '未知错误'}`, "error");
    } finally {
      setIsCleaning(false);
    }
  };

  // ==========================================================
  // R2 图床配置：与模型设置同模式——不进 siteConfig、不走待保存队列，
  // 直接读写后端 /api/r2/get|update|test，密钥只存后端本地 r2_config.json。
  // ==========================================================
  const [r2Form, setR2Form] = useState({
    enabled: false, accountId: '', bucket: '', publicBaseUrl: '', accessKeyId: '', secretAccessKey: '',
  });
  const [isSavingR2, setIsSavingR2] = useState(false);
  const [isTestingR2, setIsTestingR2] = useState(false);
  const [r2TestResult, setR2TestResult] = useState<{ success: boolean, msg: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const base = await r2ConfigBase();
        const res = await fetch(`${base}/get`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.data) {
          setR2Form({
            enabled: Boolean(data.data.enabled),
            accountId: data.data.accountId || '',
            bucket: data.data.bucket || '',
            publicBaseUrl: data.data.publicBaseUrl || '',
            accessKeyId: data.data.accessKeyId || '',       // 后端返回的脱敏值（****末四位）
            secretAccessKey: data.data.secretAccessKey || '',
          });
        }
      } catch {
        // 后端没连上时保持空表单，保存/测试时会如实报错
      }
    };
    load();
  }, []);

  const r2Update = (key: string, value: string | boolean) => setR2Form(prev => ({ ...prev, [key]: value }));

  const handleSaveR2 = async () => {
    setIsSavingR2(true);
    try {
      const base = await r2ConfigBase();
      const res = await fetch(`${base}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: r2Form })
      });
      const data = await res.json();
      if (data.success) {
        showToast("R2 配置已保存", "success");
        setR2Form(prev => ({
          ...prev,
          accessKeyId: data.data.accessKeyId || '',
          secretAccessKey: data.data.secretAccessKey || '',
        }));
      } else {
        showToast(data.message || "保存失败", "error");
      }
    } catch (e) {
      showToast(`保存失败: ${e instanceof Error ? e.message : '未知错误'}`, "error");
    } finally {
      setIsSavingR2(false);
    }
  };

  const handleTestR2 = async () => {
    setIsTestingR2(true);
    setR2TestResult(null);
    try {
      const base = await r2ConfigBase();
      const res = await fetch(`${base}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: r2Form })
      });
      const data = await res.json();
      setR2TestResult({ success: data.success, msg: data.message });
      showToast(data.success ? "R2 连接正常" : "R2 连接失败", data.success ? "success" : "error");
    } catch (e) {
      setR2TestResult({ success: false, msg: `连不上管理端后端: ${e instanceof Error ? e.message : '未知错误'}` });
    } finally {
      setIsTestingR2(false);
    }
  };

  const orphanGrid = (orphans: Orphan[], onDelete: (names: string[]) => void, sourceLabel: string) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)]">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {sourceLabel}孤儿图片（按占用大小倒序）
        </span>
        <button
          onClick={() => onDelete(orphans.map(o => o.filename))}
          disabled={isCleaning}
          className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          {isCleaning ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          <span>一键清理全部 ({orphans.length} 张)</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
        {orphans.map(orphan => (
          <div key={orphan.filename} className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--card-border)] bg-black/5 shadow-xs flex flex-col justify-end p-2">
            <img src={toPreviewSrc(orphan.url)} alt={orphan.filename} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col">
              <span className="text-[10px] font-mono text-white truncate" title={orphan.filename}>
                {orphan.filename}
              </span>
              <span className="text-[9px] text-slate-300 font-bold">
                {formatBytes(orphan.size)}
              </span>
            </div>
            <button
              onClick={() => onDelete([orphan.filename])}
              disabled={isCleaning}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
              title="删除这张图片"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 图片与孤儿文件清理（本地 + R2） */}
      <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="paper-card border border-[var(--card-border)] dark:border-slate-800/50 rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <FolderArchive size={22} className="text-[var(--accent)]" />
              图片与孤儿文件清理
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              扫描本地 <code className="text-[var(--accent)] font-mono">public/images/</code> 与 R2 存储桶中未被任何文章、说说、相册或草稿引用的孤儿图片。
            </p>
          </div>

          <button
            onClick={handleScanOrphans}
            disabled={isScanning || isCleaning}
            className="px-6 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)] text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isScanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{isScanning ? '正在扫描引用…' : '扫描孤儿图片'}</span>
          </button>
        </div>

        {scanResult && (
          <div className="mt-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">本地图片总量</span>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{scanResult.totalCount} 张</p>
              </div>
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">本地孤儿文件</span>
                <p className={`text-2xl font-black mt-1 ${scanResult.orphanCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {scanResult.orphanCount} 张
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">R2 孤儿文件</span>
                <p className={`text-2xl font-black mt-1 ${(scanResult.r2Orphans?.length || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {scanResult.r2Orphans?.length || 0} 张
                </p>
              </div>
            </div>

            {scanResult.orphanCount === 0 && (scanResult.r2Orphans?.length || 0) === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">没有垃圾文件</span>
                  <span className="text-xs opacity-80 mt-0.5">所有图片均已被杂谈、说说、相册或草稿正常引用。</span>
                </div>
              </div>
            ) : (
              <>
                {scanResult.orphanCount > 0 && orphanGrid(scanResult.orphans, handleDeleteOrphans, '本地')}
                {(scanResult.r2Orphans?.length || 0) > 0 && orphanGrid(scanResult.r2Orphans!, handleDeleteR2Orphans, 'R2')}
              </>
            )}
          </div>
        )}
      </motion.section>

      {/* 2. Cloudflare R2 图床设置 */}
      <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="paper-card border border-[var(--card-border)] dark:border-slate-800/50 rounded-2xl p-8 shadow-lg">
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <Cloud size={22} className="text-[var(--accent)]" />
          Cloudflare R2 图床
        </h2>
        <p className="text-xs text-slate-400 font-medium mb-8">
          启用后新上传的图片（先经本地压缩）存到 R2，内容里写入公开地址；关闭则走本地 public/images。
          密钥只保存在后端本地文件，不进站点配置、不入 Git。
        </p>

        <div className="max-w-xl space-y-6">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">启用 R2 图床</span>
            <button
              type="button"
              onClick={() => r2Update('enabled', !r2Form.enabled)}
              className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${r2Form.enabled ? 'bg-[var(--accent)]' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${r2Form.enabled ? 'left-6' : 'left-1'}`} />
            </button>
          </label>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cloudflare 账号 ID (Account ID)</label>
            <input
              type="text"
              placeholder="在 Cloudflare 控制台右侧栏或 R2 概览页可见"
              value={r2Form.accountId}
              onChange={e => r2Update('accountId', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-mono text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">存储桶名称 (Bucket)</label>
            <input
              type="text"
              placeholder="例如: meayu-blog-images"
              value={r2Form.bucket}
              onChange={e => r2Update('bucket', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-mono text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">公开访问地址 (Public Base URL)</label>
            <input
              type="text"
              placeholder="例如: https://pub-xxxx.r2.dev（或绑定的自定义域）"
              value={r2Form.publicBaseUrl}
              onChange={e => r2Update('publicBaseUrl', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-mono text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Access Key ID</label>
            <input
              type="text"
              placeholder="R2 API 令牌的 Access Key ID"
              value={r2Form.accessKeyId}
              onChange={e => r2Update('accessKeyId', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-mono text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Secret Access Key</label>
            <input
              type="password"
              placeholder="R2 API 令牌的 Secret（只显示一次，请妥善保存）"
              value={r2Form.secretAccessKey}
              onChange={e => r2Update('secretAccessKey', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-mono text-slate-700 dark:text-slate-200"
            />
            <p className="text-[10px] text-slate-400 mt-1 ml-1">显示 ****末四位 表示已保存且未修改；要更换密钥直接输入新值再保存。</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTestR2}
              disabled={isTestingR2}
              className="flex-1 py-3 rounded-2xl text-sm font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50"
            >
              {isTestingR2 ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
              测试连接
            </button>

            <button
              onClick={handleSaveR2}
              disabled={isSavingR2}
              className="flex-1 py-3 bg-[var(--accent)] text-white rounded-2xl text-sm font-black shadow-lg hover:bg-[var(--accent)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingR2 ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              保存配置
            </button>
          </div>

          <AnimatePresence>
            {r2TestResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${r2TestResult.success ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
                  <span className="text-xl">{r2TestResult.success ? '✓' : '✕'}</span>
                  <span className="text-sm font-bold leading-relaxed">{r2TestResult.msg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </div>
  );
}

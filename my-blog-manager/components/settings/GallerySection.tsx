import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { Trash2, RefreshCw, AlertTriangle, CheckCircle2, Image as ImageIcon, Loader2, Sparkles, FolderArchive } from 'lucide-react';
import { toPreviewSrc } from '../imagePreview';

export default function GallerySection({ formData, handleUpdate, pushToQueue }: any) {
  const { showToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean, msg: string } | null>(null);

  // 孤儿图片扫描与清理
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    totalCount: number;
    orphanCount: number;
    totalOrphanBytes: number;
    orphans: { filename: string; url: string; size: number; mtime: number }[];
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
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const configData = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${configData.api_port}/api/picbed/scan_orphans`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setScanResult(data);
        if (data.orphanCount === 0) {
          showToast("扫描完成，所有本地图片均被正常引用！", "success");
        } else {
          showToast(`扫描发现 ${data.orphanCount} 张孤儿图片`, "info");
        }
      } else {
        showToast(data.message || "扫描失败", "error");
      }
    } catch (e: any) {
      showToast(`扫描请求失败: ${e.message}`, "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteOrphans = async (filenames: string[]) => {
    if (filenames.length === 0) return;
    if (!window.confirm(`确认彻底从硬盘删除选中的 ${filenames.length} 张废弃图片吗？此操作不可撤回！`)) return;

    setIsCleaning(true);
    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const configData = await configRes.json();
      const res = await fetch(`http://127.0.0.1:${configData.api_port}/api/picbed/delete_orphans`, {
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
    } catch (e: any) {
      showToast(`删除请求失败: ${e.message}`, "error");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleTestConnection = async () => {
    // 彻底去掉写死逻辑，完全读取用户在界面输入的 URL 和 Token
    const url = formData.picBedUrl;
    const token = formData.picBedToken;

    if (!url || !token) {
      showToast("请先填完整图床地址和 Token", "warning");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    showToast("正在验证图床账号...", "info");

    try {
      const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
      const configData = await configRes.json();

      const res = await fetch(`http://127.0.0.1:${configData.api_port}/api/picbed/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, token })
      });

      const data = await res.json();
      setTestResult({ success: data.success, msg: data.message });

      if (data.success) {
        showToast("连接正常，图床可用", "success");
      } else {
        showToast("Token 无效或服务异常", "error");
      }
    } catch (error) {
      showToast("连不上管理端后端，请确认它还在运行", "error");
      setTestResult({ success: false, msg: "连不上管理端后端，请确认它还在运行" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!formData.picBedUrl || !formData.picBedToken) {
      showToast("图床地址和 Token 都不能为空", "error");
      return;
    }
    pushToQueue('图床配置');
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 1. 本地图片与孤儿图片清理 */}
      <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="paper-card border border-[var(--card-border)] dark:border-slate-800/50 rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <FolderArchive size={22} className="text-indigo-500" />
              本地图片与孤儿文件清理
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-1">
              扫描 <code className="text-indigo-500 font-mono">public/images/</code> 目录中废弃且未在任何文章、说说、相册或草稿中引用的孤儿图片。
            </p>
          </div>

          <button
            onClick={handleScanOrphans}
            disabled={isScanning || isCleaning}
            className="px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
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
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">孤儿文件数量</span>
                <p className={`text-2xl font-black mt-1 ${scanResult.orphanCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {scanResult.orphanCount} 张
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--card-border)]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">可释放磁盘空间</span>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{formatBytes(scanResult.totalOrphanBytes)}</p>
              </div>
            </div>

            {scanResult.orphanCount === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">没有垃圾文件</span>
                  <span className="text-xs opacity-80 mt-0.5">所有本地图片均已被杂谈、说说、相册或草稿正常引用。</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)]">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    孤儿图片列表（按占用大小倒序）
                  </span>
                  <button
                    onClick={() => handleDeleteOrphans(scanResult.orphans.map(o => o.filename))}
                    disabled={isCleaning}
                    className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isCleaning ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    <span>一键清理全部 ({scanResult.orphanCount} 张)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto custom-scrollbar p-1">
                  {scanResult.orphans.map(orphan => (
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
                        onClick={() => handleDeleteOrphans([orphan.filename])}
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
            )}
          </div>
        )}
      </motion.section>

      {/* 2. 外部第三方图床设置 (Lsky Pro) */}
      <motion.section initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="paper-card border border-[var(--card-border)] dark:border-slate-800/50 rounded-2xl p-8 shadow-lg">
        <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">外部图床配置 (Lsky Pro)</h2>
        <p className="text-xs text-slate-400 font-medium mb-8">如果需要将图片托管到外部独立图床，可在下方配置 API 地址与密钥。</p>

        <div className="max-w-xl space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">图床名称标识</label>
            <input
              type="text"
              value={formData.picBedName}
              onChange={e => handleUpdate('picBedName', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 font-bold text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">API 接口地址 (URL)</label>
            <input
              type="text"
              placeholder="例如: https://pic.dusays.com"
              value={formData.picBedUrl || ''}
              onChange={e => handleUpdate('picBedUrl', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">API TOKEN (鉴权密钥)</label>
            <input
              type="password"
              placeholder="输入 Bearer Token 或纯 Token"
              value={formData.picBedToken || ''}
              onChange={e => handleUpdate('picBedToken', e.target.value)}
              className="w-full paper-card border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm outline-none mt-1 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className={`flex-1 py-3 rounded-2xl text-sm font-black shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2
                ${isTesting ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-pink-500 text-white hover:bg-pink-600'}`}
            >
              {isTesting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : "测试连接"}
            </button>

            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-indigo-600 transition-all active:scale-95"
            >
              加入待保存
            </button>
          </div>

          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-2xl border flex items-center gap-3 ${testResult.success ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'}`}>
                  <span className="text-xl">{testResult.success ? '✓' : '✕'}</span>
                  <span className="text-sm font-bold leading-relaxed">{testResult.msg}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </div>
  );
}
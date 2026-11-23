import { useEffect, useState } from 'react';
import type { SettingsSectionProps } from './shared';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../ToastProvider';
import { Cloud, Save, PlugZap, Loader2 } from 'lucide-react';
import { r2ConfigBase } from '../../lib/picbed';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- props 由设置页统一传入，本分区（R2/图库）走独立 API 保存，不经表单队列
export default function GallerySection({ formData, handleUpdate, pushToQueue }: SettingsSectionProps) {
  const { showToast } = useToast();

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

  return (
    <div className="flex flex-col gap-8">
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

"use client";

import type { SettingsFormData } from '../../components/settings/shared';
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useOperations } from '../../context/OperationContext';
import { siteConfig } from '../../siteConfig';
import { ToastProvider, useToast } from '../../components/ToastProvider';

import ProfileSection from '../../components/settings/ProfileSection';
import BackgroundSection from '../../components/settings/BackgroundSection';
import GallerySection from '../../components/settings/GallerySection';
import RepoSection from '../../components/settings/RepoSection';
  import ModelSection from '../../components/settings/ModelSection';

function SettingsContent() {
  const { addOperation } = useOperations();
  const [activeTab, setActiveTab] = useState('profile');
  const { showToast } = useToast();

  const [formData, setFormData] = useState<SettingsFormData>({
    siteUrl: siteConfig.siteUrl || "",
    authorName: siteConfig.authorName || "",
    bio: siteConfig.bio || "",
    avatarUrl: siteConfig.avatarUrl || "",
    social: siteConfig.social || {},
    bgImages: [...(siteConfig.bgImages || [])],
    bgEnabled: siteConfig.bgEnabled || false,
    buildDate: siteConfig.buildDate || "2026-03-23T00:00:00",
    icpConfig: siteConfig.icpConfig || { name: "", link: "" },
  });


  useEffect(() => {
    const fetchRealConfig = async () => {
      try {
        const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
        const configData = await configRes.json();

        const res = await fetch(`http://127.0.0.1:${configData.api_port}/api/config/get`, { cache: 'no-store' });
        const data = await res.json();

        if (data.success && data.data) {
          console.log("成功从后端拉取到真实配置:", data.data);
          setFormData((prev) => ({
            ...prev,
            ...data.data,
            social: { ...(prev.social || {}), ...(data.data.social || {}) },
            buildDate: data.data.buildDate || prev.buildDate,
            icpConfig: data.data.icpConfig || prev.icpConfig,
          }));
        } else {
          console.error("后端返回失败:", data.message);
          showToast("读取后端配置失败，当前显示为本地静态数据", "warning");
        }
      } catch (error) {
        console.error("请求后端配置通道断开:", error);
        showToast("无法连接到 Python 后端服务", "error");
      }
    };

    fetchRealConfig();
  }, [showToast]);

  const handleUpdate = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };


  const pushToQueue = (label: string, key?: string, value?: unknown) => {
    addOperation({
      id: Date.now().toString(),
      type: 'CONFIG',
      label: `暂存配置：${label}`,
      description: `修改了 ${label}，等待保存到博客`,
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
      payload: formData,
      key: key,
      value: value
    });
    showToast(`【${label}】已加入待保存，请在右上角点【保存到博客】`, "success");
  };

  const menuItems = [
    { id: 'profile', name: '个人名片设置' },
    { id: 'background', name: '视觉背景配置' },
    { id: 'gallery', name: '图库配置管理' },
    { id: 'model', name: '模型设置' },
    { id: 'repo', name: '项目仓库设置' },
  ];

  return (
    <div className="min-h-screen relative pb-10">

      <div>
        <main className="w-[95%] max-w-7xl mx-auto mt-24 flex flex-col md:flex-row gap-8 items-start relative z-10">

          <div className="w-full md:w-72 shrink-0 flex flex-col gap-4">
            <div className="paper-card border border-[var(--card-border)] dark:border-slate-800/50 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black text-[var(--ink-faint)] uppercase mb-4 px-3 tracking-[0.2em]">设置分类 · Settings</p>
              <nav className="flex flex-col gap-1" aria-label="设置分类">
                {menuItems.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors duration-200 ${
                        active
                          ? 'bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent)] font-extrabold'
                          : 'text-[var(--ink-soft)] font-bold hover:bg-[var(--paper-deep)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--accent)] transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
                      />
                      <span className="truncate">{item.name}</span>
                      {active && <span aria-hidden="true" className="ml-auto text-[var(--accent)] text-xs">→</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="flex-1 w-full">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && <ProfileSection key="profile" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === 'background' && <BackgroundSection key="background" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === 'gallery' && <GallerySection key="gallery" formData={formData} handleUpdate={handleUpdate} pushToQueue={pushToQueue} />}
              {activeTab === 'model' && <ModelSection key="model" />}

              {activeTab === 'repo' && <RepoSection key="repo" />}
            </AnimatePresence>
          </div>

        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsContent />
    </ToastProvider>
  );
}
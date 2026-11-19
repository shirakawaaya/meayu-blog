"use client";
import { createContext, useContext, useEffect, useState } from 'react';

// 主题：宣纸（唯一版式，2026-11-19 起手帐版式下线）× 明/暗
type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
});

/** 把明暗状态写到 html 上；首屏由 layout 内联脚本先设一次，这里只负责后续切换 */
function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // 与内联脚本的默认值保持一致，避免水合不一致
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('manager-theme');
    const nextDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 主题只能在挂载后读 localStorage 同步，属外部状态同步而非派生状态
    setIsDark(nextDark);
    applyTheme(nextDark);
    localStorage.removeItem('manager-style');
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    applyTheme(nextDark);
    localStorage.setItem('manager-theme', nextDark ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

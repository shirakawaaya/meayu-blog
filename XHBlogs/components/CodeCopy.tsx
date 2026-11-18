"use client";

import { useEffect } from 'react';

const LANG_MAP: Record<string, string> = {
  js: 'JAVASCRIPT',
  javascript: 'JAVASCRIPT',
  ts: 'TYPESCRIPT',
  typescript: 'TYPESCRIPT',
  py: 'PYTHON',
  python: 'PYTHON',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  rb: 'RUBY',
  rs: 'RUST',
  rust: 'RUST',
  go: 'GO',
  golang: 'GO',
  sh: 'BASH',
  bash: 'BASH',
  shell: 'SHELL',
  zsh: 'ZSH',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  md: 'MARKDOWN',
  markdown: 'MARKDOWN',
  sql: 'SQL',
  java: 'JAVA',
  kt: 'KOTLIN',
  kotlin: 'KOTLIN',
  swift: 'SWIFT',
  xml: 'XML',
};

/**
 * 为文章内的代码块注入语言徽标与右上角「复制」按钮。
 *
 * 正文 HTML 由服务端 dangerouslySetInnerHTML 渲染，无法直接插入 React 节点，
 * 因此挂载后扫描容器内所有 <pre> 动态注入语言徽标与按钮；使用内联样式，
 * 避免 Tailwind 在构建时清掉动态拼接的类名。
 */
export default function CodeCopy({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const cleanups: (() => void)[] = [];

    container.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.code-copy-btn')) return;
      pre.style.position = 'relative';

      const codeEl = pre.querySelector('code');

      // 提取代码语言徽标
      let lang = '';
      if (codeEl) {
        const match = codeEl.className.match(/(?:language|lang)-([a-zA-Z0-9_+#.-]+)/i);
        if (match) {
          lang = match[1];
        } else {
          const classes = codeEl.className.split(/\s+/).filter(c => c && c !== 'hljs');
          if (classes.length > 0) lang = classes[0];
        }
      }

      if (lang) {
        const displayLang = LANG_MAP[lang.toLowerCase()] || lang.toUpperCase();
        const badge = document.createElement('span');
        badge.className = 'code-lang-badge';
        badge.textContent = displayLang;
        Object.assign(badge.style, {
          position: 'absolute',
          top: '0.5rem',
          right: '4.2rem',
          padding: '0.15rem 0.55rem',
          fontSize: '10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: '700',
          lineHeight: '1.4',
          color: 'rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '0.375rem',
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          zIndex: '10',
        } as CSSStyleDeclaration);
        pre.appendChild(badge);
        cleanups.push(() => {
          badge.remove();
        });
      }

      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = '复制';
      Object.assign(btn.style, {
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        padding: '0.15rem 0.6rem',
        fontSize: '11px',
        fontWeight: '700',
        lineHeight: '1.4',
        color: 'var(--code-fg)',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        zIndex: '10',
        transition: 'all .2s',
      } as CSSStyleDeclaration);

      const onClick = async () => {
        try {
          const codeText = codeEl ? codeEl.innerText : pre.innerText || '';
          await navigator.clipboard.writeText(codeText);
          btn.textContent = '已复制';
        } catch {
          btn.textContent = '复制失败';
        }
        setTimeout(() => { btn.textContent = '复制'; }, 1500);
      };
      btn.addEventListener('click', onClick);
      pre.appendChild(btn);
      cleanups.push(() => {
        btn.removeEventListener('click', onClick);
        btn.remove();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [containerId]);

  return null;
}

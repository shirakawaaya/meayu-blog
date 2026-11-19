"use client";

import { installBackendAuth } from '../lib/backend-auth';

/**
 * 在根布局渲染期就装上 fetch 令牌注入（见 lib/backend-auth.ts）。
 * 必须在渲染期而不是 useEffect 里装：React 的 effect 自底向上执行，
 * 页面组件的 effect 会先于布局的 effect 触发取数，装晚了首批请求会漏带令牌。
 * installBackendAuth 内部有幂等守卫，重复渲染不会叠加包装。
 */
export default function BackendAuthInit() {
  installBackendAuth();
  return null;
}

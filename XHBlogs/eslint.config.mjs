import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 图片来源含本地图、R2 公共域名（待 Cloudflare 配置后才定型）与用户粘贴的任意外链，
      // next/image 的 remotePatterns 覆盖不了任意外链，故保留原生 <img>，规则明确降为 warn。
      "@next/next/no-img-element": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

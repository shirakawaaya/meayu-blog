/**
 * 图片上传目标解析（管理端）。
 *
 * 上传走哪条路由由后端决定：后端 R2 图床配置完整且已启用 → /api/picbed/upload（R2），
 * 否则 → /api/picbed/local（博客目录 public/images）。前端不经手任何图床密钥，
 * 密钥只存后端本地 data/r2_config.json。
 *
 * 返回的 endpoint 已拼好，调用方直接 POST FormData(file) 即可。
 */
export async function resolvePicbedUpload(): Promise<{ endpoint: string; useRemote: boolean }> {
  const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
  const configData = await configRes.json();
  const base = `http://127.0.0.1:${configData.api_port}/api/picbed`;

  let useRemote = false;
  try {
    const res = await fetch(`${base}/storage`);
    const data = await res.json();
    useRemote = Boolean(data.success && data.provider === 'r2');
  } catch {
    useRemote = false; // 后端状态问不到就按本地处理，后续上传失败会如实报错
  }

  return { endpoint: useRemote ? `${base}/upload` : `${base}/local`, useRemote };
}

/** 后端 picbed API 基址（孤儿扫描等非上传接口用） */
export async function picbedBase(): Promise<string> {
  const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
  const configData = await configRes.json();
  return `http://127.0.0.1:${configData.api_port}/api/picbed`;
}

/** 后端 R2 配置 API 基址 */
export async function r2ConfigBase(): Promise<string> {
  const configRes = await fetch(`/backend_config.json?t=${Date.now()}`);
  const configData = await configRes.json();
  return `http://127.0.0.1:${configData.api_port}/api/r2`;
}

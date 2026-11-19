/**
 * 本地令牌注入（与后端 cms_core/main.py 的 require_local_token 中间件配套）。
 *
 * 为什么在 fetch 层统一注入，而不是改每个调用点：后端跑在 launcher 分配的随机端口上，
 * 调用点分散在十余个文件、各自拼 URL；逐个改既容易漏、漏一处该功能就静默失效。
 * 这里包装一次 window.fetch，只对发往 127.0.0.1 的请求补 X-Local-Token 头，其余请求原样透传。
 *
 * 令牌来源：launcher 启动时随机生成，写入 public/backend_config.json（与 api_port 同一份文件）。
 * 后端未启用令牌时（直接跑后端调试、没有 api_token 字段），本模块读不到令牌，不做任何事。
 */

type FetchFn = typeof fetch;

const FLAG = '__backendAuthInstalled';

let tokenPromise: Promise<string | null> | null = null;

function loadToken(originalFetch: FetchFn): Promise<string | null> {
  if (!tokenPromise) {
    tokenPromise = (async () => {
      try {
        const res = await originalFetch('/backend_config.json', { cache: 'no-store' });
        const data: unknown = await res.json();
        if (data && typeof data === 'object' && 'api_token' in data) {
          const token = (data as { api_token?: unknown }).api_token;
          return typeof token === 'string' && token ? token : null;
        }
        return null;
      } catch {
        return null;
      }
    })();
  }
  return tokenPromise;
}

export function installBackendAuth(): void {
  if (typeof window === 'undefined') return;
  const flagged = window as unknown as Record<string, unknown>;
  if (flagged[FLAG]) return;
  flagged[FLAG] = true;

  const originalFetch: FetchFn = window.fetch.bind(window);
  loadToken(originalFetch);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/^https?:\/\/127\.0\.0\.1:/.test(url)) {
      const token = await loadToken(originalFetch);
      if (token) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        if (!headers.has('X-Local-Token')) headers.set('X-Local-Token', token);
        return originalFetch(input, { ...init, headers });
      }
    }
    return originalFetch(input, init);
  };
}

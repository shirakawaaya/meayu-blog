import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { siteConfig } from '../../siteConfig';

/**
 * RSS 2.0 订阅源：/feed.xml
 * 运行时读取 chatters 目录生成，发布新杂谈后无需重新构建即可被订阅器读到。
 * 站点地址优先取 siteConfig.siteUrl，未配置时回退到当前请求的 origin。
 */

// 与 sitemap / robots 保持一致：构建期生成静态订阅源
export const dynamic = 'force-static';

const xmlEscape = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export async function GET(request: Request) {
  const base = (siteConfig.siteUrl || new URL(request.url).origin).replace(/\/+$/, '');

  const dir = path.join(process.cwd(), 'chatters');
  type FeedEntry = { title: string; link: string; description: string; pubDate: string; time: number };
  const entries: FeedEntry[] = [];
  try {
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .forEach((f) => {
        const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (data.private) return;
        const slug = f.replace(/\.md$/, '');
        const date = data.date || '';
        entries.push({
          title: xmlEscape(data.title || '无标题'),
          link: `${base}/chatter/${encodeURIComponent(slug)}`,
          description: xmlEscape(
            data.description || content.replace(/[#>*`~\[\]!]/g, '').trim().slice(0, 120)
          ),
          pubDate: new Date(date || '1970-01-01').toUTCString(),
          time: new Date(date || '1970-01-01').getTime() || 0,
        });
      });
  } catch {
    // 目录不存在时输出空频道，保持 feed 可访问
  }

  // 按发布日期降序，只取最近 20 篇
  entries.sort((a, b) => b.time - a.time);
  const items = entries.slice(0, 20).map(
    (e) =>
      `    <item>\n      <title>${e.title}</title>\n      <link>${e.link}</link>\n      <guid isPermaLink="true">${e.link}</guid>\n      <pubDate>${e.pubDate}</pubDate>\n      <description>${e.description}</description>\n    </item>`
  );

  // lastBuildDate 取最新一篇的发布时间，没有内容时用当前时间
  const lastBuild = entries.length > 0
    ? new Date(Math.max(...entries.map((e) => e.time))).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(siteConfig.title)}</title>
    <link>${base}</link>
    <description>${xmlEscape(siteConfig.bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

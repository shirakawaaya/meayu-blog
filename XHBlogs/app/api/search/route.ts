import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const chattersDir = path.join(process.cwd(), 'chatters');
  const momentsDir = path.join(process.cwd(), 'moments');

  const chatters: { slug: string; title: string; description: string; date: string; tags: string[]; searchText: string }[] = [];
  const moments: { id: string; date: string; content: string; location?: string; searchText: string }[] = [];

  try {
    if (fs.existsSync(chattersDir)) {
      const files = fs.readdirSync(chattersDir).filter((f) => f.endsWith('.md'));
      files.forEach((file) => {
        const fullPath = path.join(chattersDir, file);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));
        if (data.private) return;
        const plain = content.replace(/[#>*`~\[\]!]/g, ' ').replace(/\s+/g, ' ').trim();
        chatters.push({
          slug: file.replace(/\.md$/, ''),
          title: data.title || '无标题',
          description: data.description || plain.slice(0, 100),
          date: data.date || '',
          tags: Array.isArray(data.tags) ? data.tags : [],
          // 全字段拼接，供全局搜索按正文匹配（与页内 search bar 口径一致）
          searchText: [data.title, data.description, plain, (Array.isArray(data.tags) ? data.tags : []).join(' ')].filter(Boolean).join(' ').toLowerCase(),
        });
      });
    }
  } catch (e) {
    console.error('读取杂谈数据失败:', e);
  }

  try {
    if (fs.existsSync(momentsDir)) {
      const files = fs.readdirSync(momentsDir).filter((f) => f.endsWith('.md'));
      files.forEach((file) => {
        const fullPath = path.join(momentsDir, file);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));
        if (data.private) return;
        const plain = content.trim();
        moments.push({
          id: file.replace(/\.md$/, ''),
          date: data.date || '',
          content: plain.slice(0, 140),
          location: data.location || '',
          searchText: [plain, data.location].filter(Boolean).join(' ').toLowerCase(),
        });
      });
    }
  } catch (e) {
    console.error('读取说说数据失败:', e);
  }

  // 按日期降序
  chatters.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  moments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    chatters,
    moments,
  });
}

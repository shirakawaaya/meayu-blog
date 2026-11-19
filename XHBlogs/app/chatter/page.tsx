import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { ChatterListItem } from '../../lib/content-types';
import ChatterBoard from './ChatterBoard';
import { siteConfig } from '@/siteConfig';
import { excerpt } from '../../lib/excerpt';


export const metadata = {
  title: "杂谈 | "+ siteConfig.title,
  description: "日常记录",
};

export default function ChatterPage() {
  // 注意：这里我们假设你的 md 文件放在根目录的 chatters 文件夹里
  const chattersDirectory = path.join(process.cwd(), 'chatters');
  // 列表页生产端 tags/content 必填，与 ChatterBoard 的 Chatter 形状对齐
  let chatters: Array<ChatterListItem & { tags: string[]; content: string }> = [];

  try {
    // 确保文件夹存在
    if (!fs.existsSync(chattersDirectory)) {
      fs.mkdirSync(chattersDirectory);
    }

    const fileNames = fs.readdirSync(chattersDirectory).filter(fileName => fileName.endsWith('.md'));

    chatters = fileNames.map(fileName => {
      const slug = fileName.replace(/\.md$/, '');
      const fileContents = fs.readFileSync(path.join(chattersDirectory, fileName), 'utf8');
      const { data, content } = matter(fileContents);
      if (data.private) return null;

      return {
        slug,
        title: data.title || '',
        description: excerpt(data.description || content, 80),
        date: data.date || '未知时间',
        tags: data.tags || [],
        mood: data.mood || '',
        cover: data.cover || '',
        content: content, // 保留原文；摘要由 excerpt 工具剥净 Markdown 后生成
      };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => (new Date(b.date).getTime() - new Date(a.date).getTime())); // 按时间倒序
  } catch (e) {
    console.error("读取杂谈文件失败:", e);
  }

  return (
    <div className="min-h-screen relative pb-10">
      <div>
        {/* 将解析好的数据传递给客户端组件进行瀑布流渲染 */}
        <ChatterBoard chatters={chatters} />
      </div>
    </div>
  );
}

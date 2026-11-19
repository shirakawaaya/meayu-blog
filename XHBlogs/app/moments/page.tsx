import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import MomentList from './MomentList';
import { siteConfig } from '../../siteConfig';
import type { MomentListItem } from '../../lib/content-types';

export const metadata = {
  title: "说说 | " + siteConfig.title,
  description: "说说与日常记录",
};

export default function MomentsPage() {
  const allMoments: MomentListItem[] = [];

  try {
    // 说说只存 moments/ 一个目录（旧 posts/moments 探测已随 post 模型下线删除）
    const momentsDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'moments');
    if (fs.existsSync(momentsDir)) {
      const fileNames = fs.readdirSync(momentsDir).filter(f => f.endsWith('.md'));
      fileNames.forEach(fileName => {
        const fullPath = path.join(momentsDir, fileName);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));
        if (data.private) return;

        allMoments.push({
          id: fileName.replace(/\.md$/, ''),
          date: data.date || '1970-01-01',
          location: data.location || '',
          images: data.images || [],
          content: content.trim()
        });
      });
    }

  } catch (e) {
    console.error("读取说说数据失败:", e);
  }

  return (
    <div className="min-h-screen relative pb-10 flex flex-col">
      <div className="flex-1 flex flex-col">
        <MomentList
          moments={allMoments}
          authorName={siteConfig.authorName}
          avatarUrl={siteConfig.avatarUrl}
        />
      </div>
    </div>
  );
}

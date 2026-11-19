import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import MomentList from './MomentList';
import { siteConfig } from '../../siteConfig';
import { getBlogRoot } from '../../lib/blog-paths';
import type { MomentListItem } from '../../lib/content-types';

// 管理端是本机控制台，内容随时会被后端改写（发布杂谈/说说、改相册等），
// 页面必须在每次请求时实时读盘，不能被构建期静态化固化。
export const dynamic = 'force-dynamic';


export const metadata = {
  title: "说说 | " + siteConfig.authorName + " の 控制台",
  description: "说说与日常记录",
};

export default function MomentsPage() {
  const allMoments: MomentListItem[] = [];

  try {
    // 内容只存在博客目录里（管理端写入也写那边），所以这里要读博客目录。
    // 说说只存 moments/ 一个目录（旧 posts/moments 探测已随 post 模型下线删除）
    const blogRoot = getBlogRoot();

    if (!blogRoot) {
      console.warn('未配置博客物理路径，无法读取说说列表');
    }

    const momentsDir = blogRoot ? path.join(blogRoot, 'moments') : '';
    if (momentsDir && fs.existsSync(momentsDir)) {
      const fileNames = fs.readdirSync(momentsDir).filter(f => f.endsWith('.md'));
      fileNames.forEach(fileName => {
        const fullPath = path.join(momentsDir, fileName);
        const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'));

        allMoments.push({
          id: fileName.replace(/\.md$/, ''),
          date: data.date || '1970-01-01',
          location: data.location || '',
          images: data.images || [],
          isPrivate: Boolean(data.private),
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
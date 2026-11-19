// 类型定义（与博客前端 XHBlogs/data/projects.ts 保持一致）。
// 项目数据本身只存博客目录，这里不再保存任何数据副本。
export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string; // 兼容旧数据的 emoji 标识
  cover?: string; // 项目封面图 URL（优先展示）
  githubUrl: string;
  tags: string[];
};

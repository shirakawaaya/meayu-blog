/**
 * 内容数据的共享类型（博客端与管理端各一份，必须同步修改）。
 * 字段与各页面从 Markdown frontmatter 组装出的对象保持一致，可选字段表示旧内容可能缺失。
 */

export interface ChatterListItem {
  slug: string;
  title: string;
  date: string;
  tags?: string[];
  mood?: string;
  cover?: string;
  description?: string;
  formattedDate?: string;
  content?: string;
}

export interface MomentListItem {
  id: string;
  date: string;
  location?: string;
  images?: string[];
  content: string;
  isPrivate?: boolean;
}

export interface TimelinePost {
  slug: string;
  type: string;
  title: string;
  date: string;
  description?: string;
  tags: string[];
  cover?: string;
}

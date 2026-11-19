// 本文件由控制台自动生成，请勿手动修改

export type Project = {
  id: string;
  name: string;
  description: string;
  icon: string; // 兼容旧数据的 emoji 标识
  cover?: string; // 项目封面图 URL（优先展示）
  githubUrl: string;
  tags: string[];
};

export const projectsData: Project[] = [
  {
    "id": "proj_1791340859496",
    "name": "岁岁念",
    "githubUrl": "https://github.com/meayu-lomie/gift",
    "description": "情侣回忆录",
    "icon": "",
    "tags": []
  }
];
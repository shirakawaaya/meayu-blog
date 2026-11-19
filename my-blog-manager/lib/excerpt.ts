/**
 * 从 Markdown 正文提取干净的列表摘要：
 * 依次剥图片、链接（保留文字）、标题/引用标记、加粗/行内代码符号，再截断。
 * 两端各一份（目录独立），签名保持一致。
 */
export function excerpt(content: string, max = 80): string {
  let s = (content || '').replace(/\r\n/g, '\n');
  // 图片语法 ![alt](url) → alt（有说明文字时保留，否则去掉）
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 链接 [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // 块级标记：标题 / 引用 / 列表符号 / 分隔线
  s = s.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+|---+|\*\*\*+)\s*/gm, '');
  // 行内强调与代码符号
  s = s.replace(/(\*\*|__|~~|`)/g, '');
  // HTML 标签（标题区已 sanitize 过，这里再兜一层）
  s = s.replace(/<[^>]+>/g, '');
  // 折叠空白与换行
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

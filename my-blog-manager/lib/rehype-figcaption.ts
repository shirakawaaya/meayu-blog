/**
 * rehype 插件：把带 alt/title 的图片包成 <figure>，并补一行 <figcaption>。
 * 放在 rehypeSanitize 之后、stringify 之前运行——此时节点已是安全的 hast。
 * 若图片独占一个 <p>，用 figure 替换整个 p，避免 <p><figure> 的非法嵌套。
 */
import type { Plugin } from 'unified';
import type { Root, Element, RootContent } from 'hast';

export const rehypeFigcaption: Plugin<[], Root> = () => {
  return (tree: Root) => {
    // visit 接收：当前节点、父节点、父节点在祖父中的索引
    const visit = (node: RootContent | Root, parent: any, parentIdx: number) => {
      if (!node || typeof node !== 'object' || !('children' in node)) return;
      const kids = node.children as RootContent[];
      for (let i = kids.length - 1; i >= 0; i--) {
        const child = kids[i];
        if (child.type === 'element' && child.tagName === 'img') {
          const alt = typeof child.properties?.alt === 'string' ? child.properties.alt.trim() : '';
          const title = typeof child.properties?.title === 'string' ? child.properties.title.trim() : '';
          const caption = alt || title;
          const alreadyFigure = node.type === 'element' && (node as Element).tagName === 'figure';
          if (caption && !alreadyFigure) {
            const figure: Element = {
              type: 'element',
              tagName: 'figure',
              properties: { className: ['article-figure'] },
              children: [
                child,
                { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] },
              ],
            };
            // 图片独占 <p>：用 figure 替换整个 p（父在祖父里的位置由 parentIdx 给出）
            if (node.type === 'element' && (node as Element).tagName === 'p' && kids.length === 1 && parent) {
              parent.children[parentIdx] = figure;
            } else {
              kids[i] = figure;
            }
            continue;
          }
        }
        // 递归：把当前 node 当父，i 当它在父中的索引
        visit(child, node, i);
      }
    };
    visit(tree, null, -1);
  };
};

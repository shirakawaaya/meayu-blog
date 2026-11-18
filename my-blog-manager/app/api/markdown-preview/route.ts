import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';

export const runtime = 'nodejs';

/**
 * 编辑器 Markdown 源码模式的实时预览。
 *
 * 与博客前端 XHBlogs/app/chatter/[slug]/page.tsx 走同一条 unified/remark 管线
 * （含 GFM、公式、代码高亮、允许内嵌 HTML），保证「编辑器里看到的 = 发布后的样子」。
 * 改了博客端的渲染链，这里要同步改。
 */
export async function POST(request: Request) {
  let markdown = '';
  try {
    const body = await request.json();
    markdown = typeof body?.markdown === 'string' ? body.markdown : '';
  } catch {
    return Response.json({ success: false, message: '请求体不是合法 JSON' }, { status: 400 });
  }

  try {
    const html = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, { allowDangerousHtml: true })
      // @ts-ignore rehype-highlight 的选项类型声明不全，与博客端保持同样的写法
      .use(rehypeHighlight, {
        detect: true,
        ignoreMissing: true,
        subset: ['cpp', 'c', 'python', 'java', 'javascript', 'typescript', 'go', 'rust', 'bash', 'json', 'html', 'css', 'sql', 'xml'],
      })
      .use(rehypeKatex)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(markdown);

    return Response.json({ success: true, html: String(html) });
  } catch (e: any) {
    // 预览失败只影响右侧渲染，不阻塞写作；如实记日志并回传原因
    console.error('[api/markdown-preview] 渲染失败:', e);
    return Response.json({ success: false, message: e?.message || '渲染失败' }, { status: 500 });
  }
}

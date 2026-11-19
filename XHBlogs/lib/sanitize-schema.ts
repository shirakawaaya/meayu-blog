/**
 * rehype-sanitize 的白名单 schema（博客端与管理端各一份，必须同步修改）。
 *
 * 基底是 GitHub 风格的 defaultSchema，在其上放行两类「自己人」输出：
 * 1. highlight.js：代码高亮的 span/code/pre 靠 class 着色，class 本身无注入风险，整体放行；
 *    span 另放行 style —— KaTeX 的 vlist/strut 靠行内 height/top 对齐公式，剥掉公式会错位。
 * 2. KaTeX 的 MathML 部分（math/semantics/annotation 等标签及少量属性），
 *    defaultSchema 不含 MathML，不补的话公式的无障碍文本会被整段剥掉。
 *
 * 其余一律按 defaultSchema：script/iframe/事件属性/javascript: 协议等都会被剥除。
 * 管线顺序固定：remarkRehype → rehypeRaw → rehypeHighlight → rehypeKatex →
 * rehypeSanitize → rehypeStringify。rehypeRaw 不能省：原始 HTML 不先解析成节点，
 * sanitize 会把整段 raw 直接丢弃（合法的 <img> 等也会遭殃）。
 */
import { defaultSchema } from 'rehype-sanitize';

type Schema = typeof defaultSchema;

const MATHML_TAGS = [
  'math', 'semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
  'mspace', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'munder',
  'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mphantom', 'menclose',
  'merror', 'mstyle',
];

export const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...MATHML_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...((defaultSchema.attributes?.['*'] as string[]) ?? []), 'className'],
    span: ['className', 'style', 'ariaHidden'],
    div: [...(((defaultSchema.attributes?.div as string[]) ?? [])), 'className'],
    code: ['className'],
    pre: ['className'],
    math: ['xmlns'],
    annotation: ['encoding'],
    mspace: ['width', 'height', 'depth'],
    mi: ['mathvariant'],
    mo: ['mathvariant'],
    mn: ['mathvariant'],
    ms: ['mathvariant'],
    mtext: ['mathvariant'],
    mfrac: ['linethickness'],
    menclose: ['notation'],
    mstyle: ['displaystyle', 'scriptlevel'],
    mtable: ['columnalign', 'rowalign', 'columnspacing', 'rowspacing'],
    mtd: ['columnalign', 'rowspan', 'columnspan'],
    munder: ['accentunder'],
    mover: ['accent'],
    munderover: ['accent', 'accentunder'],
  },
};

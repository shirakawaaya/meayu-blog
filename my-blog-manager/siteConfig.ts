// siteConfig.ts - 你的全站"控制中心"

export const siteConfig = {
  // 0. 站点完整地址（RSS / sitemap / 分享链接用；改成本站实际域名）
  siteUrl: "https://meayu.ipv64.net",

  // 1. 网站标题与博主信息
  title: "Meayu の 拾光集",
  faviconUrl: "https://pub-fb69f942aae94d15ae8765a54b31b18c.r2.dev/20261123_192934_4210c3.jpg",
  authorName: "Meayu",
  bio: "记录代码、生活与沿途的光。",

  navTitle: "Meayu",

  // 【新增】导航栏中间的那个后缀/分隔符（默认是 の）
  navSuffix: "の",

  navAfter: "拾光集",

  // 2. 头像设置 (支持网络链接，或将图片放入 public 文件夹后使用 "/me.jpg")
  avatarUrl: "https://pub-fb69f942aae94d15ae8765a54b31b18c.r2.dev/20261119_163004_b7646f.jpg",

  // 3. 网站背景设置 (二选一)
  // 如果想用纯图片背景，请在下面 bgImage 写路径，并将 useGradient 设为 false
  useGradient: false,
  themeColors: ["#a18cd1", "#fbc2eb", "#a1c4fd", "#c2e9fb"], // 呼吸流动的颜色组合
// 修改这里：变成图片数组
  bgImages: ["https://pub-fb69f942aae94d15ae8765a54b31b18c.r2.dev/20261123_164546_3f7402.jpg", "https://pub-fb69f942aae94d15ae8765a54b31b18c.r2.dev/20261123_164602_627cc2.jpg", "https://pub-fb69f942aae94d15ae8765a54b31b18c.r2.dev/20261123_164613_434360.jpg"],
  bgEnabled: true, // 全站背景轮播开关（在管理端【视觉背景配置】里切换）

  // 4. 文章默认封面图 (当 Markdown 没写 cover 时显示)
  defaultPostCover: "",

  // 5. 首页照片墙预览图
  photoWallImage: "",
  social: {
    github: "https://github.com/shirakawaaya",
    gitee: "",
    google: "mailto:bilibiliwuwuwu@gmail.com",
    email: "1124533793@qq.com",
    qq: "1124533793",
    wechat: "Meayu",
  },
  chatterTitle: "杂谈", // 栏目名，与说说页同构
  chatterDescription: "代码与日常碎片的记录",

  buildDate: "2026-01-01T00:00:00", // 版权年起始（非真实建站日）
  // 备案信息（页脚展示；留空则不渲染）
  icpConfig: {
    name: "萌ICP备 20260240号",
    link: "https://icp.gov.moe/?keyword=20260240",
  },
};
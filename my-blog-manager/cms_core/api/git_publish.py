"""管理端「推送到 GitHub」：把 XHBlogs/ 下已写入的内容提交并推送到部署仓库。

只提交博客目录（XHBlogs/），不碰管理端自身的改动；推送走 VM 轮询的 meayu-blog/main。
"""
import os
import subprocess
from datetime import datetime

from fastapi import APIRouter

from cms_core.paths import get_blog_root, BLOG_NOT_CONFIGURED_MSG

router = APIRouter()

# 直连 GitHub 会因默认 HTTP/2 与本机代理不兼容报 TLS unexpected eof，
# 必须显式降 HTTP/1.1 并走代理；实测这两参数在无代理环境变量的子进程里也生效。
_GIT = ["git", "-c", "http.version=HTTP/1.1", "-c", "http.proxy=http://127.0.0.1:7890"]
_REMOTE = "meayu-blog"
_BRANCH = "main"


def _run(args, cwd, timeout=120):
    """执行 git 子进程，返回 (returncode, 合并输出)。输出只截取尾部，避免刷屏。"""
    try:
        p = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True,
            timeout=timeout, encoding="utf-8", errors="replace",
        )
        out = ((p.stdout or "") + "\n" + (p.stderr or "")).strip()
        return p.returncode, out[-1200:]
    except subprocess.TimeoutExpired:
        return 124, "git 命令超时（120 秒）"
    except FileNotFoundError:
        return 127, "未找到 git 可执行文件，请确认 git 已安装并加入 PATH"
    except Exception as e:
        return 1, str(e)


@router.post("/publish")
async def git_publish():
    blog_root = get_blog_root()
    if not blog_root:
        return {"success": False, "message": BLOG_NOT_CONFIGURED_MSG}

    repo_root = os.path.dirname(os.path.abspath(blog_root))
    subdir = os.path.basename(os.path.abspath(blog_root))
    if not subdir:
        return {"success": False, "message": "无法解析博客目录名"}

    # 确认仓库根确实是 git 仓库
    rc, out = _run(["git", "rev-parse", "--show-toplevel"], repo_root, timeout=20)
    if rc != 0:
        return {"success": False, "message": f"博客目录的上一级不是 git 仓库：{out}"}

    # 1) 只暂存博客目录；用 pathspec 精确限定，暂存区里已有的其它改动不受影响
    rc, out = _run(_GIT + ["add", "--", subdir], repo_root, timeout=60)
    if rc != 0:
        return {"success": False, "message": f"暂存改动失败：{out}"}

    # 2) 检查博客目录是否真有可提交的改动
    rc, out = _run(["git", "diff", "--cached", "--quiet", "--", subdir], repo_root, timeout=30)
    if rc == 0:
        return {"success": False, "message": "博客目录没有需要提交的改动"}
    if rc != 1:
        return {"success": False, "message": f"检查改动失败：{out}"}

    # 3) 只提交该子目录（pathspec 限定，杜绝把暂存区其它文件带进来）
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    message = f"blog: 发布管理端内容改动（{stamp}）"
    rc, out = _run(_GIT + ["commit", "-m", message, "--", subdir], repo_root, timeout=120)
    if rc != 0:
        return {"success": False, "message": f"提交失败：{out}"}

    # 4) 推送到部署仓库 main
    rc, out = _run(_GIT + ["push", _REMOTE, _BRANCH], repo_root, timeout=180)
    if rc != 0:
        return {
            "success": False,
            "message": f"本地已提交（{message}），但推送失败：{out}。可稍后手动 push。",
            "committed": True,
        }

    return {"success": True, "message": f"已提交并推送：{message}", "output": out}

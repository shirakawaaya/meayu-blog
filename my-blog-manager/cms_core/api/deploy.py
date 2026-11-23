import os
import json
from fastapi import APIRouter, Request

router = APIRouter()

CURRENT_API_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_API_DIR, "..", ".."))
CONFIG_FILE = os.path.join(PROJECT_ROOT, "data", "deploy_config.json")


@router.get("/config")
async def get_deploy_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    # 默认返回双轨结构
    return {
        "blogPath": "",
        "staticRepoUrl": "",
        "staticBranch": "gh-pages",
        "sourceRepoUrl": "",
        "sourceBranch": "main"
    }


@router.post("/config")
async def save_deploy_config(request: Request):
    try:
        data = await request.json()
        os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "部署配置已保存"}
    except Exception as e:
        return {"success": False, "message": f"保存失败: {str(e)}"}


# 物理路径校验（原先在 sync 模块里，同步环节移除后搬到这里）
@router.post("/check-path")
async def check_blog_path(request: Request):
    """检测博客前端路径是否合法且具备基本结构"""
    try:
        payload = await request.json()
        target_path = (payload.get("blogPath") or "").strip()

        if not target_path or not os.path.exists(target_path):
            return {"success": False, "message": "博客目录不存在，请检查输入"}

        # 防呆：必须是 Next.js 项目（含 package.json），避免误选到别处
        if not os.path.exists(os.path.join(target_path, "package.json")):
            return {"success": False,
                    "message": "该路径下没有 package.json，看起来不是博客前端项目，已拦截。"}

        # 博客前端的内容目录：chatters（杂谈）/ moments（说说）/ data / app
        missing = [d for d in ["chatters", "moments", "data", "app"]
                   if not os.path.exists(os.path.join(target_path, d))]
        if missing:
            return {"success": True,
                    "message": f"路径可用，但缺少这些目录：{', '.join(missing)}（保存后会按需创建）"}

        return {"success": True, "message": "路径校验通过，目录结构完整"}
    except Exception as e:
        return {"success": False, "message": f"校验异常: {str(e)}"}

# 根据 type 动态获取/生成不同的 SSH 密钥，并自动配置路由

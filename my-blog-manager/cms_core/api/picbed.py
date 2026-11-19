import os
import io
import uuid
import datetime

from fastapi import APIRouter, Body, UploadFile, File

from cms_core.paths import get_blog_root
from cms_core import r2_client
from cms_core.api import r2_config as r2cfg

router = APIRouter()

# ============================================================
# 图片压缩（上传到本地 public/images 前自动执行）
# 用 Pillow：限制最长边 + 转 JPEG 压质，显著减小文件体积
# Pillow 不可用时静默降级为原图直存，不影响上传流程
# ============================================================
try:
    from PIL import Image as PILImage
    _HAS_PIL = True
except ImportError:
    PILImage = None
    _HAS_PIL = False

# 最长边超过此值才缩放（博客展示 2000px 完全够用）
_MAX_SIDE = 2000
# JPEG 压缩质量
_JPEG_QUALITY = 85


def _compress_image(content: bytes, ext: str) -> tuple[bytes, str]:
    """压缩图片，返回 (新字节, 新扩展名)。失败时原样返回不抛错。"""
    if not _HAS_PIL:
        return content, ext
    try:
        img = PILImage.open(io.BytesIO(content))
        img.load()

        # GIF 动图不能压缩（会丢帧），直接原样保留
        if getattr(img, "is_animated", False):
            return content, ext

        # 缩放：最长边超过 2000px 等比缩小
        if max(img.size) > _MAX_SIDE:
            img.thumbnail((_MAX_SIDE, _MAX_SIDE), PILImage.LANCZOS)

        # PNG 带 alpha 通道时保留 PNG 重压；其余统一转 JPEG 压质
        has_alpha = img.mode in ("RGBA", "LA", "P")
        if ext == ".png" and has_alpha:
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            new_bytes = buf.getvalue()
            # 压缩有效才替换，否则保留原图
            if len(new_bytes) < len(content):
                return new_bytes, ext
            return content, ext

        out_ext = ext if ext in (".jpg", ".jpeg") else ".jpg"
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        new_bytes = buf.getvalue()
        if len(new_bytes) < len(content):
            return new_bytes, out_ext
        return content, ext
    except Exception:
        # 任何压缩失败都退回原图，保证上传不被阻断
        return content, ext


# ============================================================
# 一、Cloudflare R2 图床（替代已下线的 Lsky Pro）
# ------------------------------------------------------------
# 凭据只存 data/r2_config.json（不入 Git），前端不再经手任何密钥：
# 前端先问 /storage 决定走 R2 还是本地，再把文件发到对应端点。
# R2 未启用/未配全时 /storage 返回 local，上传自动落本地目录。
# ============================================================

_CONTENT_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".bmp": "image/bmp", ".ico": "image/x-icon",
}


@router.get("/storage")
async def storage_info():
    """告诉前端当前新图片的上传目标：r2 或 local"""
    cfg = r2cfg._load_config()
    configured = r2cfg.is_configured(cfg)
    return {
        "success": True,
        "provider": "r2" if configured else "local",
        "configured": configured,
        "publicBaseUrl": cfg.get("publicBaseUrl", "") if configured else "",
    }


@router.post("/upload")
async def upload_image_r2(file: UploadFile = File(...)):
    """
    把图片（先压缩）上传到 Cloudflare R2，返回公开访问 URL。
    R2 未配置时明确报错，不静默落本地——走哪条路由前端已用 /storage 确认过。
    """
    cfg = r2cfg._load_config()
    if not r2cfg.is_configured(cfg):
        return {"success": False, "message": "R2 图床还没配置好，请到【设置 → 图库】填写 R2 配置，或关闭 R2 开关走本地存储"}

    try:
        filename = file.filename or "image.png"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            return {"success": False, "message": f"不支持的文件类型 {ext or '(无扩展名)'}，仅支持 {', '.join(sorted(ALLOWED_EXT))}"}

        content = await file.read()
        if not content:
            return {"success": False, "message": "文件内容为空"}
        if len(content) > MAX_SIZE:
            return {"success": False, "message": "图片超过 20MB，请压缩后再传"}

        content, ext = _compress_image(content, ext)

        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        rand = uuid.uuid4().hex[:6]
        key = f"{stamp}_{rand}{ext}"

        await r2_client.put_object(cfg, key, content, _CONTENT_TYPES.get(ext, "application/octet-stream"))
        return {
            "success": True,
            "message": "已上传到 R2 图床",
            "url": r2cfg.public_url(cfg, key),
            "filename": key,
        }
    except Exception as e:
        return {"success": False, "message": f"R2 上传失败: {str(e)}"}


# ============================================================
# 二、本地图床：图片写进博客前端 public/images/（唯一真相源）
# ------------------------------------------------------------
# 返回 /images/xxx.png 相对路径，本地预览即时可用；
# 部署后由站点自身提供，不依赖任何第三方图床。
# ============================================================

# 允许的图片扩展名（防止上传可执行文件）
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"}
# 上传大小上限 20MB
MAX_SIZE = 20 * 1024 * 1024


def _images_dir() -> str:
    """前端 public/images 目录"""
    blog_root = get_blog_root()
    if not blog_root:
        return ""
    return os.path.join(blog_root, "public", "images")


@router.get("/local/info")
async def local_picbed_info():
    """告诉前端：本地图片目录是否可用"""
    images_dir = _images_dir()
    return {
        "success": True,
        "images_dir": images_dir,
        "available": bool(images_dir),
    }


@router.post("/local")
async def upload_image_local(file: UploadFile = File(...)):
    """
    把图片存到博客前端的 public/images/ 目录。
    返回 url 为本地相对路径（/images/xxx.png）——本地预览即时可用，
    部署后由站点自身提供，不依赖任何第三方图床。
    """
    images_dir = _images_dir()
    if not images_dir:
        return {
            "success": False,
            "message": "还没设置博客目录，请到【设置 → 项目仓库设置】里填一下",
        }

    try:
        filename = file.filename or "image.png"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            return {
                "success": False,
                "message": f"不支持的文件类型 {ext or '(无扩展名)'}，仅支持 {', '.join(sorted(ALLOWED_EXT))}",
            }

        os.makedirs(images_dir, exist_ok=True)

        # 时间戳+随机串，避免重名覆盖
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        rand = uuid.uuid4().hex[:6]
        safe_name = f"{stamp}_{rand}{ext}"
        save_path = os.path.join(images_dir, safe_name)

        content = await file.read()
        if not content:
            return {"success": False, "message": "文件内容为空"}
        if len(content) > MAX_SIZE:
            return {"success": False, "message": "图片超过 20MB，请压缩后再传"}

        # 自动压缩：最长边 2000px + JPEG 压质（压缩失败/无效时保留原图）
        content, ext = _compress_image(content, ext)
        # 压缩可能改变扩展名（如 png → jpg），文件名跟随更新
        if not safe_name.endswith(ext):
            safe_name = os.path.splitext(safe_name)[0] + ext
            save_path = os.path.join(images_dir, safe_name)

        with open(save_path, "wb") as f:
            f.write(content)

        local_path = f"/images/{safe_name}"

        return {
            "success": True,
            "message": "已保存到本地图片目录",
            "url": local_path,
            "filename": safe_name,
        }
    except Exception as e:
        return {"success": False, "message": f"保存失败: {str(e)}"}


# ============================================================
# 三、孤儿图片扫描与一键清理
# ------------------------------------------------------------
# 扫描 public/images/ 中未被任何杂谈、说说、相册、草稿等引用的废弃图片
# ============================================================

def _collect_all_referenced_content(blog_root: str) -> str:
    from cms_core.paths import MANAGER_ROOT
    all_texts = []

    # 1. 扫描博客端常用内容与配置文件
    scan_dirs = [
        os.path.join(blog_root, "chatters"),
        os.path.join(blog_root, "moments"),
        os.path.join(blog_root, "data"),
        os.path.join(blog_root, "app"),
    ]
    for sdir in scan_dirs:
        if os.path.exists(sdir):
            for root, _, files in os.walk(sdir):
                for f in files:
                    if f.endswith((".md", ".ts", ".tsx", ".json", ".js")):
                        try:
                            with open(os.path.join(root, f), "r", encoding="utf-8", errors="ignore") as fp:
                                all_texts.append(fp.read())
                        except Exception:
                            pass

    # 根目录的 siteConfig.ts
    for root_file in ["siteConfig.ts", "siteConfig.js"]:
        cfg_path = os.path.join(blog_root, root_file)
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8", errors="ignore") as fp:
                    all_texts.append(fp.read())
            except Exception:
                pass

    # 2. 扫描管理端草稿箱（未发布的草稿引用的图片保留，避免误删）
    drafts_dir = os.path.join(MANAGER_ROOT, "manager_data", "drafts")
    if os.path.exists(drafts_dir):
        for f in os.listdir(drafts_dir):
            if f.endswith(".json"):
                try:
                    with open(os.path.join(drafts_dir, f), "r", encoding="utf-8", errors="ignore") as fp:
                        all_texts.append(fp.read())
                except Exception:
                    pass

    return "\n".join(all_texts)


@router.post("/scan_orphans")
async def scan_orphan_images():
    images_dir = _images_dir()
    if not images_dir or not os.path.exists(images_dir):
        return {"success": False, "message": "未找到本地图片目录，请先在【设置】中配置博客根目录"}

    blog_root = get_blog_root()
    all_content = _collect_all_referenced_content(blog_root)

    total_files = []
    orphans = []

    for filename in os.listdir(images_dir):
        full_path = os.path.join(images_dir, filename)
        if not os.path.isfile(full_path):
            continue

        if filename.startswith(".") or filename in ("README.md", "favicon.ico"):
            continue

        size = os.path.getsize(full_path)
        mtime = int(os.path.getmtime(full_path) * 1000)
        total_files.append(filename)

        if filename not in all_content:
            orphans.append({
                "filename": filename,
                "url": f"/images/{filename}",
                "size": size,
                "mtime": mtime
            })

    orphans.sort(key=lambda x: x["size"], reverse=True)
    total_orphan_bytes = sum(x["size"] for x in orphans)

    # R2 桶内孤儿：对象 key 与公开 URL 都不在引用内容里才算孤儿
    r2_total = 0
    r2_orphans = []
    cfg = r2cfg._load_config()
    if r2cfg.is_configured(cfg):
        try:
            objects = await r2_client.list_objects(cfg)
            r2_total = len(objects)
            for obj in objects:
                if obj["key"] not in all_content and r2cfg.public_url(cfg, obj["key"]) not in all_content:
                    r2_orphans.append({
                        "filename": obj["key"],
                        "url": r2cfg.public_url(cfg, obj["key"]),
                        "size": obj["size"],
                        "mtime": 0
                    })
            r2_orphans.sort(key=lambda x: x["size"], reverse=True)
        except Exception:
            pass  # R2 列举失败不阻断本地扫描结果

    return {
        "success": True,
        "totalCount": len(total_files),
        "orphanCount": len(orphans),
        "totalOrphanBytes": total_orphan_bytes,
        "orphans": orphans,
        "r2TotalCount": r2_total,
        "r2Orphans": r2_orphans,
        "r2OrphanBytes": sum(x["size"] for x in r2_orphans)
    }


@router.post("/delete_orphans")
async def delete_orphan_images(payload: dict = Body(...)):
    images_dir = _images_dir()
    if not images_dir or not os.path.exists(images_dir):
        return {"success": False, "message": "未找到本地图片目录"}

    filenames = payload.get("filenames", [])
    if not filenames:
        return {"success": False, "message": "未提供要删除的文件列表"}

    images_dir_abs = os.path.abspath(images_dir)
    deleted_count = 0
    errors = []

    for fname in filenames:
        safe_name = os.path.basename(fname)
        if safe_name.startswith(".") or not safe_name:
            continue
        target_path = os.path.abspath(os.path.join(images_dir, safe_name))
        # 严格防穿越校验
        if not target_path.startswith(images_dir_abs):
            continue

        if os.path.exists(target_path) and os.path.isfile(target_path):
            try:
                os.remove(target_path)
                deleted_count += 1
            except Exception as e:
                errors.append(f"{safe_name}: {str(e)}")

    return {
        "success": True,
        "deletedCount": deleted_count,
        "errors": errors,
        "message": f"已成功清理 {deleted_count} 张孤儿图片"
    }


@router.post("/delete_r2_orphans")
async def delete_r2_orphan_images(payload: dict = Body(...)):
    """删除 R2 桶内的孤儿对象（key 列表由扫描结果给出）"""
    cfg = r2cfg._load_config()
    if not r2cfg.is_configured(cfg):
        return {"success": False, "message": "R2 图床未配置"}

    keys = payload.get("filenames", [])
    if not keys:
        return {"success": False, "message": "未提供要删除的对象列表"}

    deleted_count = 0
    errors = []
    for key in keys:
        safe_key = str(key).lstrip("/")
        if not safe_key or ".." in safe_key:
            continue
        try:
            await r2_client.delete_object(cfg, safe_key)
            deleted_count += 1
        except Exception as e:
            errors.append(f"{safe_key}: {str(e)}")

    return {
        "success": True,
        "deletedCount": deleted_count,
        "errors": errors,
        "message": f"已成功清理 {deleted_count} 张 R2 孤儿图片"
    }

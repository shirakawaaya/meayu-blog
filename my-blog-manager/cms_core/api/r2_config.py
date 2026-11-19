"""
图床设置 API：Cloudflare R2 配置（替代已下线的 Lsky Pro 外链图床）。

配置存储在 my-blog-manager/data/r2_config.json（本地文件，不入 Git，
已在仓库根 .gitignore 排除）。Access Key / Secret 只落这份本地文件，
读取接口一律脱敏返回（只回末四位）——绝不写入 siteConfig.ts。

字段：
- enabled        是否启用 R2 作为新图片的上传目标（关 = 走本地 public/images）
- accountId      Cloudflare 账号 ID（S3 端点由此拼出）
- bucket         存储桶名
- publicBaseUrl  公开访问地址（如 https://pub-xxxx.r2.dev，或日后绑定的自定义域）
- accessKeyId    R2 API 令牌的 Access Key ID
- secretAccessKey R2 API 令牌的 Secret Access Key
"""

import json
import os

from fastapi import APIRouter, Body

from cms_core.paths import MANAGER_ROOT
from cms_core import r2_client

router = APIRouter()

DEFAULT_CONFIG = {
    "enabled": False,
    "accountId": "",
    "bucket": "",
    "publicBaseUrl": "",
    "accessKeyId": "",
    "secretAccessKey": "",
}

_SECRET_FIELDS = ("accessKeyId", "secretAccessKey")


def _config_path() -> str:
    return os.path.join(MANAGER_ROOT, "data", "r2_config.json")


def _load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    try:
        if os.path.exists(_config_path()):
            with open(_config_path(), "r", encoding="utf-8") as f:
                stored = json.load(f)
            cfg.update({k: v for k, v in stored.items() if k in DEFAULT_CONFIG})
    except Exception:
        pass
    return cfg


def _mask(value: str) -> str:
    if not value:
        return ""
    return f"****{value[-4:]}" if len(value) > 8 else "****"


def _masked_view(cfg: dict) -> dict:
    view = dict(cfg)
    for field in _SECRET_FIELDS:
        view[field] = _mask(cfg.get(field, ""))
        view[f"has{field[0].upper() + field[1:]}"] = bool(cfg.get(field))
    return view


def _merge_updates(cfg: dict, updates: dict) -> dict:
    """合并前端提交：脱敏值（****开头）视为未修改；普通文本字段空值跳过；
    enabled 是布尔开关，单独处理。"""
    for k in DEFAULT_CONFIG:
        if k not in updates:
            continue
        if k == "enabled":
            cfg[k] = bool(updates[k])
            continue
        v = str(updates[k]).strip()
        if k in _SECRET_FIELDS and (not v or v.startswith("****")):
            continue
        if k == "publicBaseUrl":
            v = v.rstrip("/")
        cfg[k] = v
    return cfg


def is_configured(cfg: dict | None = None) -> bool:
    """R2 是否可用：开关打开且关键字段齐全"""
    cfg = cfg if cfg is not None else _load_config()
    return bool(
        cfg.get("enabled")
        and cfg.get("accountId")
        and cfg.get("bucket")
        and cfg.get("publicBaseUrl")
        and cfg.get("accessKeyId")
        and cfg.get("secretAccessKey")
    )


def public_url(cfg: dict, key: str) -> str:
    return f"{cfg['publicBaseUrl'].rstrip('/')}/{key}"


@router.get("/get")
def get_r2_config():
    return {"success": True, "data": _masked_view(_load_config())}


@router.post("/update")
def update_r2_config(payload: dict = Body(...)):
    cfg = _merge_updates(_load_config(), payload.get("updates") or {})
    if cfg.get("enabled") and not is_configured(cfg):
        return {
            "success": False,
            "message": "已打开 R2 开关，但账号 ID / 存储桶 / 公开地址 / Access Key / Secret 还没填完整",
        }
    try:
        os.makedirs(os.path.dirname(_config_path()), exist_ok=True)
        with open(_config_path(), "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception as e:
        return {"success": False, "message": f"写入配置文件失败: {e}"}
    return {"success": True, "data": _masked_view(cfg)}


@router.post("/test")
async def test_r2_connection(payload: dict = Body(...)):
    """用「已保存配置 + 表单未保存值」做一次 List 测试"""
    cfg = _merge_updates(_load_config(), payload.get("updates") or {})
    missing = [k for k in ("accountId", "bucket", "accessKeyId", "secretAccessKey") if not cfg.get(k)]
    if missing:
        return {"success": False, "message": f"还没填：{', '.join(missing)}"}
    try:
        await r2_client.test_connection(cfg)
        return {"success": True, "message": f"连接成功，存储桶「{cfg['bucket']}」可读写" }
    except Exception as e:
        return {"success": False, "message": f"连接失败：{e}"}

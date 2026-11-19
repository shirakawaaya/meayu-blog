"""
Cloudflare R2 的最小 S3 客户端（SigV4 签名，基于 httpx，不引入 boto3）。

R2 的 S3 兼容端点（virtual-hosted 形式）：
    https://<bucket>.<accountId>.r2.cloudflarestorage.com/<key>
region 固定 "auto"，service 固定 "s3"。

只实现图床需要的四个操作：PutObject / DeleteObject / ListObjectsV2 / 测试连通（List max-keys=1）。
凭据从 cms_core.api.r2_config 读取，本模块不落盘、不打印密钥。
"""

import hashlib
import hmac
import datetime
from urllib.parse import quote
import xml.etree.ElementTree as ET

import httpx

_REGION = "auto"
_SERVICE = "s3"


def _signing_key(secret: str, date_stamp: str) -> bytes:
    def _hmac(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = _hmac(("AWS4" + secret).encode("utf-8"), date_stamp)
    k_region = _hmac(k_date, _REGION)
    k_service = _hmac(k_region, _SERVICE)
    return _hmac(k_service, "aws4_request")


def _signed_headers(cfg: dict, method: str, key: str = "", body: bytes = b"",
                    content_type: str = "", query: dict | None = None) -> tuple[str, dict]:
    """返回 (完整 URL, 请求头)。key 为空表示对桶本身操作（List）。"""
    account_id = cfg["accountId"].strip()
    bucket = cfg["bucket"].strip()
    host = f"{bucket}.{account_id}.r2.cloudflarestorage.com"
    path = "/" + quote(key, safe="/") if key else "/"
    url = f"https://{host}{path}"

    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(body).hexdigest()

    headers = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if content_type:
        headers["content-type"] = content_type

    signed_header_names = sorted(headers.keys())
    canonical_headers = "".join(f"{name}:{headers[name].strip()}\n" for name in signed_header_names)
    signed_headers = ";".join(signed_header_names)

    query_items = sorted((query or {}).items())
    canonical_qs = "&".join(f"{quote(k, safe='')}={quote(str(v), safe='')}" for k, v in query_items)
    if canonical_qs:
        url = f"{url}?{canonical_qs}"

    canonical_request = "\n".join([
        method, path, canonical_qs, canonical_headers, signed_headers, payload_hash,
    ])
    scope = f"{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])
    signature = hmac.new(
        _signing_key(cfg["secretAccessKey"], date_stamp),
        string_to_sign.encode("utf-8"), hashlib.sha256,
    ).hexdigest()
    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={cfg['accessKeyId'].strip()}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )
    # httpx 不需要再单独传 host 头（会按 URL 设置），但保留也无妨；去掉避免重复
    headers.pop("host", None)
    return url, headers


def _error_message(resp: httpx.Response) -> str:
    """从 S3 XML 错误响应里提炼 Code/Message"""
    try:
        root = ET.fromstring(resp.text)
        code = root.findtext("Code") or f"HTTP {resp.status_code}"
        msg = root.findtext("Message") or ""
        return f"{code}: {msg}".strip()
    except Exception:
        return f"HTTP {resp.status_code}: {resp.text[:200]}"


async def put_object(cfg: dict, key: str, content: bytes, content_type: str) -> None:
    url, headers = _signed_headers(cfg, "PUT", key=key, body=content, content_type=content_type)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.put(url, content=content, headers=headers)
    if resp.status_code not in (200, 204):
        raise RuntimeError(_error_message(resp))


async def delete_object(cfg: dict, key: str) -> None:
    url, headers = _signed_headers(cfg, "DELETE", key=key)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(url, headers=headers)
    if resp.status_code not in (200, 204):
        raise RuntimeError(_error_message(resp))


async def list_objects(cfg: dict) -> list[dict]:
    """列出桶内全部对象（自动翻页），返回 [{key, size, lastModified}]"""
    objects: list[dict] = []
    token = ""
    ns = "{http://s3.amazonaws.com/doc/2006-03-01/}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        while True:
            query = {"list-type": "2", "max-keys": "1000"}
            if token:
                query["continuation-token"] = token
            url, headers = _signed_headers(cfg, "GET", query=query)
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(_error_message(resp))
            root = ET.fromstring(resp.text)
            for item in root.findall(f"{ns}Contents"):
                objects.append({
                    "key": item.findtext(f"{ns}Key") or "",
                    "size": int(item.findtext(f"{ns}Size") or 0),
                    "lastModified": item.findtext(f"{ns}LastModified") or "",
                })
            truncated = (root.findtext(f"{ns}IsTruncated") or "false") == "true"
            token = root.findtext(f"{ns}NextContinuationToken") or ""
            if not truncated or not token:
                break
    return objects


async def test_connection(cfg: dict) -> int:
    """连通性测试：ListObjectsV2 max-keys=1 成功即通，返回桶内是否已有对象（1/0 的粗略信号不重要，调用方只看成败）"""
    query = {"list-type": "2", "max-keys": "1"}
    url, headers = _signed_headers(cfg, "GET", query=query)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code != 200:
        raise RuntimeError(_error_message(resp))
    return 1

"""Supabase Storage helpers — upload base64 images + files, return public URL."""
import base64
import os
import re
import uuid
from typing import Optional
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = os.environ.get("SUPABASE_BUCKET", "sankalp-files")

_client: Optional[Client] = None


def _supa() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def ensure_bucket():
    """Create the bucket as public if it doesn't exist."""
    try:
        client = _supa()
        # list_buckets returns list of bucket objects
        buckets = client.storage.list_buckets()
        names = [b.name if hasattr(b, "name") else b.get("name") for b in buckets]
        if BUCKET not in names:
            client.storage.create_bucket(BUCKET, options={"public": True})
    except Exception as e:
        # Bucket already exists or another non-fatal error
        print(f"[storage] ensure_bucket: {e}")


def upload_data_url(data_url: str, folder: str = "uploads", ext: Optional[str] = None) -> str:
    """Accept a data URL like 'data:image/png;base64,...' and upload to Supabase. Returns public URL."""
    m = re.match(r"data:(?P<mime>[\w./+-]+);base64,(?P<data>.+)", data_url, re.DOTALL)
    if not m:
        raise ValueError("Not a valid data URL")
    mime = m.group("mime")
    raw = base64.b64decode(m.group("data"))
    if ext is None:
        ext = mime.split("/")[-1].split("+")[0]
        if ext == "jpeg":
            ext = "jpg"
    filename = f"{folder}/{uuid.uuid4().hex}.{ext}"
    client = _supa()
    client.storage.from_(BUCKET).upload(
        filename,
        raw,
        file_options={"content-type": mime, "upsert": "true"},
    )
    return client.storage.from_(BUCKET).get_public_url(filename)


def upload_bytes(raw: bytes, mime: str, folder: str = "uploads", ext: str = "bin") -> str:
    filename = f"{folder}/{uuid.uuid4().hex}.{ext}"
    client = _supa()
    client.storage.from_(BUCKET).upload(
        filename,
        raw,
        file_options={"content-type": mime, "upsert": "true"},
    )
    return client.storage.from_(BUCKET).get_public_url(filename)

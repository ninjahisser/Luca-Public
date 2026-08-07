from __future__ import annotations

import argparse
import hashlib
import io
import json
import mimetypes
import os
import re
import subprocess
import sys
import threading
import tempfile
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import time
import traceback


ROOT = Path(__file__).resolve().parent
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".mp4", ".webm", ".ogg", ".mov", ".avi"}
SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", ".cms-thumb-cache", ".cms-upload-temp"}

# ---- Video download/split tool (backend of the CMS "Tools" tab) ----
# Jobs run in a background thread; the browser polls /cms-api/download-video/status.
DOWNLOAD_JOBS: dict[str, dict] = {}
DOWNLOAD_JOBS_LOCK = threading.Lock()
sys.path.insert(0, str(ROOT / "scripts"))
try:
    import download_video as download_video_mod
except Exception:  # pragma: no cover - missing script should not break the server
    download_video_mod = None

# ---- Foto thumbnail tool (backend of the CMS "Tools" tab) ----
# Same background-job pattern; the browser polls /cms-api/foto-thumbs/status.
THUMB_JOBS: dict[str, dict] = {}
THUMB_JOBS_LOCK = threading.Lock()
try:
    import generate_foto_thumbs as foto_thumbs_mod
except Exception:  # pragma: no cover - missing script should not break the server
    foto_thumbs_mod = None

PREVIEW_JOBS: dict[str, dict] = {}
PREVIEW_JOBS_LOCK = threading.Lock()
try:
    import generate_index_previews as index_previews_mod
except Exception:  # pragma: no cover - missing script should not break the server
    index_previews_mod = None

VIDEO_UPLOAD_JOBS: dict[str, dict] = {}
VIDEO_UPLOAD_JOBS_LOCK = threading.Lock()


def _run_thumb_job(job: dict) -> None:
    def progress(message: str) -> None:
        job["progress"].append(message)

    try:
        if foto_thumbs_mod is None:
            raise RuntimeError("scripts/generate_foto_thumbs.py could not be imported")
        result = foto_thumbs_mod.generate_foto_thumbs(progress=progress)
        job["state"] = "done"
        job["result"] = result
    except Exception as exc:
        job["state"] = "error"
        job["error"] = str(exc)


def _run_preview_job(job: dict) -> None:
    def progress(message: str) -> None:
        job["progress"].append(message)

    try:
        if index_previews_mod is None:
            raise RuntimeError("scripts/generate_index_previews.py could not be imported")
        result = index_previews_mod.generate_index_previews(progress=progress)
        job["state"] = "done"
        job["result"] = result
    except Exception as exc:
        job["state"] = "error"
        job["error"] = str(exc)


def _job_id() -> str:
    return f"job_{int(time.time() * 1000)}"


def _run_download_job(job: dict, url: str, work_name: str, chunk_size: int) -> None:
    def progress(message: str) -> None:
        job["progress"].append(message)

    try:
        if download_video_mod is None:
            raise RuntimeError("scripts/download_video.py could not be imported")
        metadata = download_video_mod.download_and_split(
            url, work_name, chunk_size=chunk_size, progress=progress
        )
        job["state"] = "done"
        job["metadata"] = metadata
    except Exception as exc:
        job["state"] = "error"
        job["error"] = str(exc)

def _run_video_upload_job(job: dict, temp_path: Path, original_name: str, work_name: str, chunk_size: int) -> None:
    """Process an already-saved temp video file: compress, preview, split."""
    def progress(message: str) -> None:
        job["progress"].append(message)

    try:
        if download_video_mod is None:
            raise RuntimeError("scripts/download_video.py could not be imported")

        size_mb = temp_path.stat().st_size / 1024 / 1024 if temp_path.exists() else 0
        progress(f"Bestand ontvangen: {original_name} ({size_mb:.1f} MB)")
        progress("Compressie, preview en opsplitsing gestart...")
        metadata = download_video_mod.download_and_split(
            str(temp_path), work_name, chunk_size=chunk_size, progress=progress
        )
        job["state"] = "done"
        job["metadata"] = metadata
    except Exception as exc:
        job["state"] = "error"
        job["error"] = str(exc)
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


def safe_workspace_path(raw_path: str, allowed_suffixes: tuple[str, ...]) -> Path:
    candidate = Path(unquote(raw_path)).as_posix().lstrip("/")
    if not candidate.endswith(allowed_suffixes):
        raise ValueError(f"Only {', '.join(allowed_suffixes)} paths are allowed")

    resolved = (ROOT / candidate).resolve()
    if ROOT not in resolved.parents and resolved != ROOT:
        raise ValueError("Path escapes workspace")
    return resolved


def safe_html_path(raw_path: str) -> Path:
    return safe_workspace_path(raw_path, (".html",))


def safe_text_path(raw_path: str) -> Path:
    return safe_workspace_path(raw_path, (".html", ".css"))


THUMB_CACHE_DIR = ROOT / ".cms-thumb-cache"
THUMB_MAX_DIM = 320
VIDEO_EXTENSIONS = {".mp4", ".webm", ".ogg", ".mov", ".avi"}


def _thumb_cache_path(source: Path) -> Path:
    # Keyed by path + mtime + size, so an edited/replaced source file
    # (which changes those) invalidates the cache automatically.
    stat = source.stat()
    key = hashlib.sha1(f"{source}:{stat.st_mtime_ns}:{stat.st_size}".encode("utf-8")).hexdigest()
    return THUMB_CACHE_DIR / f"{key}.jpg"


def _generate_image_thumb(source: Path, target: Path) -> None:
    from PIL import Image, ImageOps

    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im)  # respect camera rotation metadata
        im = im.convert("RGB")
        width, height = im.size
        if max(width, height) > THUMB_MAX_DIM:
            scale = THUMB_MAX_DIM / max(width, height)
            im = im.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        im.save(target, "JPEG", quality=70, optimize=True)


def _generate_video_thumb(source: Path, target: Path) -> None:
    if download_video_mod is None:
        raise RuntimeError("scripts/download_video.py could not be imported")
    ffmpeg = download_video_mod.find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found")

    target.parent.mkdir(parents=True, exist_ok=True)
    scale = f"scale='if(gt(iw,ih),{THUMB_MAX_DIM},-2)':'if(gt(iw,ih),-2,{THUMB_MAX_DIM})'"
    # A 1s-in frame is usually past any opening black/fade; some very short
    # clips don't have a frame there, so fall back to the very first frame.
    for seek in ("1", "0"):
        cmd = [ffmpeg, "-y", "-ss", seek, "-i", str(source), "-frames:v", "1", "-vf", scale, str(target)]
        result = subprocess.run(cmd, capture_output=True)
        if target.is_file() and target.stat().st_size > 0:
            return
        if result.returncode == 0:
            break
    raise RuntimeError("ffmpeg produced no thumbnail frame")


def get_or_create_thumb(source: Path) -> Path:
    THUMB_CACHE_DIR.mkdir(exist_ok=True)
    target = _thumb_cache_path(source)
    if target.is_file() and target.stat().st_size > 0:
        return target

    ext = source.suffix.lower()
    if ext in VIDEO_EXTENSIONS:
        _generate_video_thumb(source, target)
    else:
        _generate_image_thumb(source, target)
    return target


def safe_upload_filename(raw_name: str) -> str:
    name = Path(raw_name or "image").stem or "image"
    ext = Path(raw_name or "").suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        ext = ".png"

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-") or "image"
    stamp = int(time.time() * 1000)
    return f"{stamp}-{slug}{ext}"


def parse_multipart_file(raw_body: bytes, content_type: str) -> tuple[str, bytes]:
    match = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type)
    if not match:
        raise ValueError("Missing multipart boundary")

    boundary = (match.group(1) or match.group(2) or "").encode("utf-8")
    if not boundary:
        raise ValueError("Invalid multipart boundary")

    delimiter = b"--" + boundary
    for part in raw_body.split(delimiter):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue

        if b"\r\n\r\n" not in part:
            continue

        header_blob, payload = part.split(b"\r\n\r\n", 1)
        headers: dict[str, str] = {}
        for line in header_blob.decode("utf-8", errors="replace").split("\r\n"):
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            headers[key.strip().lower()] = value.strip()

        disposition = headers.get("content-disposition", "")
        if 'name="file"' not in disposition and "name=file" not in disposition:
            continue

        filename_match = re.search(r'filename=(?:"([^"]+)"|([^;]+))', disposition)
        filename = (filename_match.group(1) or filename_match.group(2) or "image.png") if filename_match else "image.png"
        return filename, payload.rstrip(b"\r\n")

    raise ValueError("Missing file field")


RANGE_HEADER_RE = re.compile(r"bytes=(\d*)-(\d*)$")


def list_server_images() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for file_path in ROOT.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if any(part in SKIP_DIRS for part in file_path.parts):
            continue
        if file_path.parts[:2] == ("videos", "uploads"):
            # Chunks, compressed proxies, and index previews generated by
            # the video upload/download pipeline - assigned automatically
            # by that flow, not something to browse and pick by hand.
            continue

        rel = file_path.relative_to(ROOT).as_posix()
        items.append({
            "path": rel,
            "name": file_path.name,
            "mtime": str(int(file_path.stat().st_mtime))
        })

    items.sort(key=lambda entry: entry["path"].lower())
    return items


class CMSHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        # Disable caching for the local CMS/site server so saved HTML is immediately visible.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, text: str, status: int = 200, content_type: str = "text/plain; charset=utf-8") -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/cms-api/status":
            self._send_json({"ok": True, "root": str(ROOT), "supportsFileApi": True})
            return

        if parsed.path == "/cms-api/index":
            index_path = ROOT / "index.html"
            if not index_path.exists():
                self._send_json({"error": "index.html not found"}, status=404)
                return
            self._send_text(index_path.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")
            return

        if parsed.path == "/cms-api/work":
            params = parse_qs(parsed.query)
            requested = (params.get("path") or [""])[0]
            if not requested:
                self._send_json({"error": "Missing ?path"}, status=400)
                return
            try:
                target = safe_html_path(requested)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return

            if not target.exists():
                self._send_json({"error": f"File not found: {requested}"}, status=404)
                return

            self._send_text(target.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")
            return

        if parsed.path == "/cms-api/file":
            params = parse_qs(parsed.query)
            requested = (params.get("path") or [""])[0]
            if not requested:
                self._send_json({"error": "Missing ?path"}, status=400)
                return
            try:
                target = safe_text_path(requested)
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return

            if not target.exists():
                self._send_json({"error": f"File not found: {requested}"}, status=404)
                return

            content_type = "text/css; charset=utf-8" if target.suffix.lower() == ".css" else "text/html; charset=utf-8"
            self._send_text(target.read_text(encoding="utf-8"), content_type=content_type)
            return

        if parsed.path == "/cms-api/images":
            self._send_json({"ok": True, "images": list_server_images()})
            return

        if parsed.path == "/cms-api/thumb":
            params = parse_qs(parsed.query)
            requested = (params.get("path") or [""])[0]
            if not requested:
                self._send_json({"error": "Missing ?path"}, status=400)
                return
            try:
                source = safe_workspace_path(requested, tuple(IMAGE_EXTENSIONS))
            except ValueError as exc:
                self._send_json({"error": str(exc)}, status=400)
                return
            if not source.is_file():
                self._send_json({"error": f"File not found: {requested}"}, status=404)
                return

            if source.suffix.lower() == ".svg":
                # Already a small vector file - no thumbnail needed.
                self.send_response(200)
                self.send_header("Content-Type", "image/svg+xml")
                self.send_header("Content-Length", str(source.stat().st_size))
                self.end_headers()
                self.wfile.write(source.read_bytes())
                return

            try:
                thumb = get_or_create_thumb(source)
            except Exception as exc:
                self._send_json({"error": f"Thumbnail failed: {exc}"}, status=500)
                return

            data = thumb.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if parsed.path == "/cms-api/download-video/status":
            params = parse_qs(parsed.query)
            job_id = (params.get("id") or [""])[0]
            with DOWNLOAD_JOBS_LOCK:
                job = DOWNLOAD_JOBS.get(job_id)
            if not job:
                self._send_json({"error": "Unknown job"}, status=404)
                return
            self._send_json({
                "state": job["state"],
                "progress": job["progress"],
                "metadata": job.get("metadata"),
                "error": job.get("error")
            })
            return

        if parsed.path == "/cms-api/upload-video/status":
            params = parse_qs(parsed.query)
            job_id = (params.get("id") or [""])[0]
            with VIDEO_UPLOAD_JOBS_LOCK:
                job = VIDEO_UPLOAD_JOBS.get(job_id)
            if not job:
                self._send_json({"error": "Unknown job"}, status=404)
                return
            self._send_json({
                "state": job["state"],
                "progress": job["progress"],
                "metadata": job.get("metadata"),
                "error": job.get("error")
            })
            return
        if parsed.path == "/cms-api/foto-thumbs/status":
            params = parse_qs(parsed.query)
            job_id = (params.get("id") or [""])[0]
            with THUMB_JOBS_LOCK:
                job = THUMB_JOBS.get(job_id)
            if not job:
                self._send_json({"error": "Unknown job"}, status=404)
                return
            self._send_json({
                "state": job["state"],
                "progress": job["progress"],
                "result": job.get("result"),
                "error": job.get("error")
            })
            return

        if parsed.path == "/cms-api/index-previews/status":
            params = parse_qs(parsed.query)
            job_id = (params.get("id") or [""])[0]
            with PREVIEW_JOBS_LOCK:
                job = PREVIEW_JOBS.get(job_id)
            if not job:
                self._send_json({"error": "Unknown job"}, status=404)
                return
            self._send_json({
                "state": job["state"],
                "progress": job["progress"],
                "result": job.get("result"),
                "error": job.get("error")
            })
            return
        if parsed.path == "/cms-api/upload":
            self._send_json({"error": "Use POST"}, status=405)
            return

        self._serve_static_with_range()

    def _serve_static_with_range(self) -> None:
        """SimpleHTTPRequestHandler doesn't support Range requests, which
        <video> relies on for fast seeking (fetching just the bytes around
        the seek target instead of the whole file). Handle those here;
        everything else falls through to the normal static handler."""
        range_header = self.headers.get("Range")
        if not range_header:
            super().do_GET()
            return

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            super().do_GET()
            return

        match = RANGE_HEADER_RE.match(range_header.strip())
        if not match:
            super().do_GET()
            return

        file_size = os.path.getsize(path)
        start_str, end_str = match.groups()
        if start_str:
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        elif end_str:
            start = max(0, file_size - int(end_str))
            end = file_size - 1
        else:
            self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "Invalid Range header")
            return

        end = min(end, file_size - 1)
        if start < 0 or start > end or start >= file_size:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        length = end - start + 1
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        try:
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(length))
            self.end_headers()

            f.seek(start)
            remaining = length
            chunk_size = 256 * 1024
            while remaining > 0:
                chunk = f.read(min(chunk_size, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
        finally:
            f.close()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/cms-api/download-video":
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(content_length)
                payload = json.loads(raw.decode("utf-8"))
            except Exception as exc:
                self._send_json({"error": f"Invalid JSON payload: {exc}"}, status=400)
                return

            url = (payload.get("url") or "").strip()
            work_name = (payload.get("workName") or "").strip()
            try:
                chunk_size = int(payload.get("chunkSize") or (100 * 1024 * 1024))
            except (TypeError, ValueError):
                chunk_size = 100 * 1024 * 1024
            if chunk_size <= 0:
                chunk_size = 100 * 1024 * 1024

            if not url:
                self._send_json({"error": "Missing url"}, status=400)
                return

            job_id = _job_id()
            job = {"state": "running", "progress": [], "metadata": None, "error": None}
            with DOWNLOAD_JOBS_LOCK:
                DOWNLOAD_JOBS[job_id] = job

            thread = threading.Thread(
                target=_run_download_job, args=(job, url, work_name, chunk_size), daemon=True
            )
            thread.start()

            self._send_json({"ok": True, "id": job_id})
            return

        if parsed.path == "/cms-api/foto-thumbs":
            job_id = _job_id()
            job = {"state": "running", "progress": [], "result": None, "error": None}
            with THUMB_JOBS_LOCK:
                THUMB_JOBS[job_id] = job

            thread = threading.Thread(target=_run_thumb_job, args=(job,), daemon=True)
            thread.start()

            self._send_json({"ok": True, "id": job_id})
            return

        if parsed.path == "/cms-api/index-previews":
            job_id = _job_id()
            job = {"state": "running", "progress": [], "result": None, "error": None}
            with PREVIEW_JOBS_LOCK:
                PREVIEW_JOBS[job_id] = job

            thread = threading.Thread(target=_run_preview_job, args=(job,), daemon=True)
            thread.start()

            self._send_json({"ok": True, "id": job_id})
            return

        if parsed.path == "/cms-api/upload":
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._send_json({"error": "Expected multipart/form-data"}, status=400)
                return

            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                raw_body = self.rfile.read(content_length)
                original_name, file_bytes = parse_multipart_file(raw_body, content_type)

                # The only two callers of this endpoint are both the "image"
                # component's upload picker, but nothing validated the bytes
                # actually decode as an image - a wrong/corrupt file would
                # write successfully and only surface as a broken <img> once
                # someone looks at the page. Reject it here instead.
                try:
                    from PIL import Image
                    with Image.open(io.BytesIO(file_bytes)) as im:
                        im.verify()
                except Exception:
                    self._send_json({"error": "Upload failed: file is not a valid image"}, status=400)
                    return

                safe_name = safe_upload_filename(original_name)
                uploads_dir = ROOT / "images" / "uploads"
                uploads_dir.mkdir(parents=True, exist_ok=True)
                target = uploads_dir / safe_name

                with target.open("wb") as handle:
                    handle.write(file_bytes)

                self._send_json({"ok": True, "path": f"images/uploads/{safe_name}", "name": safe_name})
                return
            except Exception as exc:
                self._send_json({"error": f"Upload failed: {exc}"}, status=500)
                return

        if parsed.path == "/cms-api/upload-video":
            params = parse_qs(parsed.query)
            requested_work = (params.get("workName") or [""])[0]
            file_name = (params.get("fileName") or ["video.mp4"])[0]
            try:
                chunk_size = int((params.get("chunkSize") or [str(100 * 1024 * 1024)])[0])
            except (TypeError, ValueError):
                chunk_size = 100 * 1024 * 1024
            if chunk_size <= 0:
                chunk_size = 100 * 1024 * 1024

            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                if content_length <= 0:
                    self._send_json({"error": "No file data received (Content-Length is 0)"}, status=400)
                    return

                # Stream directly to disk — never loads the whole video into RAM
                upload_dir = ROOT / ".cms-upload-temp"
                upload_dir.mkdir(parents=True, exist_ok=True)
                suffix = Path(file_name).suffix.lower() or ".mp4"
                slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", Path(file_name).stem).strip("-") or "video"
                temp_path = upload_dir / f"{int(time.time() * 1000)}-{slug}{suffix}"

                STREAM_CHUNK = 4 * 1024 * 1024  # 4 MB per read
                bytes_written = 0
                with temp_path.open("wb") as fh:
                    while bytes_written < content_length:
                        to_read = min(STREAM_CHUNK, content_length - bytes_written)
                        data = self.rfile.read(to_read)
                        if not data:
                            break
                        fh.write(data)
                        bytes_written += len(data)

                if not requested_work:
                    requested_work = Path(file_name).stem or "video"

                job_id = _job_id()
                job = {"state": "running", "progress": [], "metadata": None, "error": None}
                with VIDEO_UPLOAD_JOBS_LOCK:
                    VIDEO_UPLOAD_JOBS[job_id] = job

                thread = threading.Thread(
                    target=_run_video_upload_job,
                    args=(job, temp_path, file_name, requested_work, chunk_size),
                    daemon=True,
                )
                thread.start()
                self._send_json({"ok": True, "id": job_id})
                return
            except Exception as exc:
                self._send_json({"error": f"Video upload failed: {exc}"}, status=500)
                return

        if parsed.path != "/cms-api/save":
            self._send_json({"error": "Unknown API endpoint"}, status=404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length)
            payload = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            self._send_json({"error": f"Invalid JSON payload: {exc}"}, status=400)
            return

        index_html = payload.get("indexHtml")
        works = payload.get("works", [])
        files = payload.get("files", [])

        if not isinstance(index_html, str):
            self._send_json({"error": "indexHtml must be a string"}, status=400)
            return

        try:
            (ROOT / "index.html").write_text(index_html, encoding="utf-8")

            saved_count = 0
            for item in works:
                path_value = item.get("path")
                html_value = item.get("html")
                if not isinstance(path_value, str) or not isinstance(html_value, str):
                    continue

                target = safe_html_path(path_value)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(html_value, encoding="utf-8")
                saved_count += 1

            saved_files = 0
            for item in files:
                path_value = item.get("path")
                content_value = item.get("content")
                if not isinstance(path_value, str) or not isinstance(content_value, str):
                    continue

                target = safe_text_path(path_value)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content_value, encoding="utf-8")
                saved_files += 1

            self._send_json({"ok": True, "savedWorks": saved_count, "savedFiles": saved_files})
        except Exception as exc:
            self._send_json({"error": f"Save failed: {exc}"}, status=500)


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    def handle_error(self, request, client_address) -> None:
        exc_type, exc, tb = sys.exc_info()
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, TimeoutError)):
            return
        if isinstance(exc, OSError) and getattr(exc, "winerror", None) in {10053, 10054}:
            return
        traceback.print_exception(exc_type, exc, tb)


def main() -> None:
    parser = argparse.ArgumentParser(description="Local CMS API + static server for portfolio")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    server = QuietThreadingHTTPServer(("127.0.0.1", args.port), CMSHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{args.port}")
    print("Open /cms/ in your browser to use the CMS with automatic file detection.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

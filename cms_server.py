from __future__ import annotations

import argparse
import json
import os
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import time


ROOT = Path(__file__).resolve().parent
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"}
SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__"}


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


def list_server_images() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for file_path in ROOT.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if any(part in SKIP_DIRS for part in file_path.parts):
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

        if parsed.path == "/cms-api/upload":
            self._send_json({"error": "Use POST"}, status=405)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/cms-api/upload":
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._send_json({"error": "Expected multipart/form-data"}, status=400)
                return

            try:
                content_length = int(self.headers.get("Content-Length", "0"))
                raw_body = self.rfile.read(content_length)
                original_name, file_bytes = parse_multipart_file(raw_body, content_type)
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Local CMS API + static server for portfolio")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), CMSHandler)
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

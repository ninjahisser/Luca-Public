#!/usr/bin/env python3
"""
Generate compressed, low-resolution thumbnails for the fotografie selectie page
so the photo grid loads fast previews first, then swaps in the high-res originals.

- Scans fotografie_selectie.html for <img> tags
- Creates a compressed JPEG thumbnail for each source image
- Mirrors the folder structure under opdrachten/Fotografie/thumbs/
- Rewrites the HTML: src -> thumbnail path, adds data-full with the original
- The existing lightbox (js/lightbox.js) already uses data-full for the full view

Idempotent: re-running backfills missing data-full attributes and only
regenerates thumbnails that are missing or older than their source image.

Usage:
    python scripts/generate_foto_thumbs.py
    # or import generate_foto_thumbs and call generate_foto_thumbs(progress=...)

Requires Pillow: pip install Pillow
"""

import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = PROJECT_ROOT / "fotografie_selectie.html"
SOURCE_ROOT = PROJECT_ROOT / "opdrachten" / "Fotografie"
THUMB_ROOT = PROJECT_ROOT / "opdrachten" / "Fotografie" / "thumbs"
THUMB_MAX_WIDTH = 480
JPEG_QUALITY = 60

# Match the full <img ...> element so we can inspect/replace every attribute.
IMG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
SRC_RE = re.compile(r'\bsrc="([^"]+)"', re.IGNORECASE)
# Collapse repeated identical data-full attributes left over from earlier runs.
DUP_DATA_FULL_RE = re.compile(r'( data-full="([^"]*)"){2,}')
QUERY_RE = re.compile(r"[?#].*$")

# Original files have mixed casing (.PNG / .jpg). Try in order when backfilling.
_EXT_CANDIDATES = (".jpg", ".PNG", ".JPG", ".png", ".jpeg", ".JPEG")


def _load_pil():
    try:
        from PIL import Image  # noqa: F401

        return Image
    except ImportError:
        return None


def _original_from_thumb(thumb_rel: str) -> str | None:
    """Map an existing thumb rel-path back to its original rel-path."""
    sub = thumb_rel.replace("\\", "/")
    if "thumbs/" not in sub:
        return None
    stem = sub.split("thumbs/", 1)[1]
    if not stem.lower().startswith("export/"):
        return None
    base = SOURCE_ROOT / stem
    for ext in _EXT_CANDIDATES:
        candidate = base.with_suffix(ext)
        if candidate.is_file():
            return candidate.relative_to(PROJECT_ROOT).as_posix()
    return None


def _thumb_target(src: str) -> str | None:
    """Map a source src attribute to the thumbnail rel-path, or None if skipped."""
    clean = QUERY_RE.sub("", src or "").strip()
    if not clean or clean.startswith(("http://", "https://", "//", "/")):
        return None
    if "thumbs/" in clean:
        return None

    rel = clean.replace("\\", "/")
    source = (PROJECT_ROOT / rel).resolve()
    if not source.is_file():
        return None

    try:
        sub = source.relative_to(SOURCE_ROOT.resolve())
    except ValueError:
        return None

    return (THUMB_ROOT / sub.with_suffix(".jpg")).relative_to(PROJECT_ROOT).as_posix()


def generate_foto_thumbs(progress=None) -> dict:
    """Generate thumbnails and rewrite fotografie_selectie.html."""
    def report(message: str) -> None:
        if progress:
            progress(message)

    Image = _load_pil()
    if Image is None:
        raise RuntimeError("Pillow is required. Install with: pip install Pillow")

    if not HTML_PATH.is_file():
        raise RuntimeError(f"File not found: {HTML_PATH}")

    html = HTML_PATH.read_text(encoding="utf-8")
    seen = set()
    mappings = []  # (original_rel, thumb_rel)
    errors = []

    for match in IMG_RE.finditer(html):
        tag = match.group(0)
        src_match = SRC_RE.search(tag)
        if not src_match:
            continue
        src = src_match.group(1)
        if src in seen:
            continue
        seen.add(src)

        clean = QUERY_RE.sub("", src or "").strip()
        if not clean or clean.startswith(("http://", "https://", "//", "/")):
            continue

        if "thumbs/" in clean:
            # Already pointing at a thumbnail: backfill data-full only.
            original = _original_from_thumb(clean)
            if original:
                mappings.append((original, clean))
            continue

        thumb_rel = _thumb_target(clean)
        if thumb_rel is None:
            continue

        source = (PROJECT_ROOT / clean).resolve()
        target = (PROJECT_ROOT / thumb_rel).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        stale = (not target.is_file()) or target.stat().st_mtime < source.stat().st_mtime
        try:
            if stale:
                im = Image.open(source)
                im = im.convert("RGB")
                width, height = im.size
                if width > THUMB_MAX_WIDTH:
                    new_height = max(1, int(height * THUMB_MAX_WIDTH / width))
                    im = im.resize((THUMB_MAX_WIDTH, new_height), Image.LANCZOS)
                im.save(target, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
                size_kb = max(1, target.stat().st_size // 1024)
                report(f"thumb: {clean} -> {thumb_rel} ({size_kb} KB)")
            mappings.append((clean, thumb_rel))
        except Exception as exc:  # pragma: no cover - surface per-image failures
            errors.append(f"{clean}: {exc}")
            report(f"error: {clean}: {exc}")

    if not mappings:
        if errors:
            raise RuntimeError("No images processed.\n" + "\n".join(errors))
        report("No images to process.")
        return {"ok": True, "generated": 0, "updated": False}

    # Rewrite HTML: src -> thumb, add data-full with the original.
    def _replace(match: re.Match) -> str:
        tag = match.group(0)
        src_match = SRC_RE.search(tag)
        if not src_match:
            return tag
        old_src = src_match.group(1)
        if "data-full=" in tag:
            return tag
        for original, thumb_rel in mappings:
            if old_src == original or old_src == thumb_rel:
                return tag.replace(
                    f'src="{old_src}"',
                    f'src="{thumb_rel}" data-full="{original}"',
                    1,
                )
        return tag

    updated = DUP_DATA_FULL_RE.sub(lambda m: ' data-full="' + m.group(2) + '"', IMG_RE.sub(_replace, html))
    changed = updated != html
    if changed:
        HTML_PATH.write_text(updated, encoding="utf-8")
        report(f"Updated {HTML_PATH.name}: {len(mappings)} thumbnails + data-full.")

    return {"ok": True, "generated": len(mappings), "updated": changed}


def main() -> None:
    def print_progress(message: str) -> None:
        print(message)

    try:
        result = generate_foto_thumbs(progress=print_progress)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"\nDone: {result['generated']} thumbnail(s) generated, HTML updated: {result['updated']}.")


if __name__ == "__main__":
    main()

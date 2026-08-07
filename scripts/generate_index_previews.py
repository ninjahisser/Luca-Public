#!/usr/bin/env python3
"""Generate compressed index preview videos for existing videos/uploads/* folders.

For each folder with metadata.json and a playable source file, this script creates
preview_360p.mp4 (roughly 1/3 resolution) and updates metadata.json with:
    "index_preview": "preview_360p.mp4"
"""

import json
import os
import glob

from download_video import PROJECT_ROOT, create_index_preview


def find_source_file(folder):
    candidates = []
    for path in glob.glob(os.path.join(folder, "source.*")):
        name = os.path.basename(path).lower()
        if ".part" in name:
            continue
        if not any(name.endswith(ext) for ext in (".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv")):
            continue
        candidates.append(path)
    if not candidates:
        return ""
    return max(candidates, key=os.path.getsize)


def reassemble_source(folder, metadata):
    """Rebuild the original source from split .part chunks when the source
    file itself was removed after splitting. Returns the reassembled path
    (which the caller must delete afterwards) or ''."""
    chunks = metadata.get("chunks") or []
    if not chunks:
        return ""

    first = (chunks[0].get("path") or "").replace("\\", "/")
    if ".part" not in first:
        candidate = os.path.join(folder, first)
        return candidate if os.path.isfile(candidate) else ""

    base_name = first.split(".part")[0]  # e.g. source.webm
    target = os.path.join(folder, base_name)
    if os.path.isfile(target):
        return ""

    try:
        with open(target, "wb") as out:
            for chunk in sorted(chunks, key=lambda c: c.get("index", 0)):
                part = os.path.join(folder, chunk.get("path", ""))
                with open(part, "rb") as handle:
                    out.write(handle.read())
        return target
    except Exception:
        return ""

def generate_index_previews(progress=None):
    uploads_dir = os.path.join(PROJECT_ROOT, "videos", "uploads")
    if not os.path.isdir(uploads_dir):
        message = "No videos/uploads directory found."
        if progress:
            progress(message)
        else:
            print(message)
        return {"processed": 0, "generated": 0}

    processed = 0
    generated = 0

    def emit(message):
        if progress:
            progress(message)
        else:
            print(message)

    for entry in sorted(os.listdir(uploads_dir)):
        folder = os.path.join(uploads_dir, entry)
        if not os.path.isdir(folder):
            continue

        metadata_path = os.path.join(folder, "metadata.json")
        if not os.path.isfile(metadata_path):
            continue

        processed += 1
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        source_file = find_source_file(folder)
        reassembled = False
        if not source_file:
            source_file = reassemble_source(folder, metadata)
            reassembled = bool(source_file)
            if source_file:
                emit(f"[{entry}] reassembled original from chunks")
        if not source_file:
            emit(f"[{entry}] skipped: no source file")
            continue

        preview_path = create_index_preview(source_file, folder, lambda m: emit(f"[{entry}] {m}"))
        if reassembled:
            try:
                os.remove(source_file)
            except OSError:
                pass
        if not preview_path:
            continue

        metadata["index_preview"] = preview_path
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
            f.write("\n")

        generated += 1

    emit(f"Done. processed={processed}, generated={generated}")
    return {"processed": processed, "generated": generated}


def main():
    generate_index_previews()


if __name__ == "__main__":
    main()

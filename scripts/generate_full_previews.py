#!/usr/bin/env python3
"""Backfill the full-length seek preview for existing videos/uploads/* folders
that don't have one yet.

create_full_preview() (see download_video.py) is the low-bitrate proxy the
player falls back to when the streaming Service Worker isn't available -
without it, that fallback skips straight to fetching every raw chunk in
full before playback can start. It was added to the upload pipeline after
some works were already uploaded, so any work uploaded before that has no
safety net if the Service Worker ever fails to activate for a visitor.

For each multi-chunk folder (total_size > chunk_size) with metadata.json
and no full_preview yet, this generates preview_full-<timestamp>.mp4 and
updates metadata.json with:
    "full_preview": "preview_full-<timestamp>.mp4"
"""

import json
import os
import time

from download_video import PROJECT_ROOT, create_full_preview
from generate_index_previews import find_source_file, reassemble_source


def generate_full_previews(progress=None):
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

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        chunk_size = metadata.get("chunk_size")
        total_size = metadata.get("total_size", 0)
        if not chunk_size or total_size <= chunk_size:
            continue  # single-chunk source: no fallback proxy needed

        existing = metadata.get("full_preview")
        if existing and os.path.isfile(os.path.join(folder, existing)):
            continue  # already has one

        processed += 1
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

        artifact_stamp = str(int(time.time() * 1000))
        preview_path = create_full_preview(
            source_file, folder, lambda m: emit(f"[{entry}] {m}"),
            target_name=f"preview_full-{artifact_stamp}.mp4",
        )

        if reassembled:
            # Same transient-lock risk as generate_index_previews.py's
            # reassembly cleanup - retry with backoff instead of a single
            # attempt that can silently leave the temp file on disk.
            removed = False
            for attempt in range(5):
                try:
                    os.remove(source_file)
                    removed = True
                    break
                except OSError:
                    if attempt < 4:
                        time.sleep(0.5)
            if not removed:
                emit(f"[{entry}] warning: could not remove temporary reassembled file {os.path.basename(source_file)} - left on disk")

        if not preview_path:
            continue

        metadata["full_preview"] = preview_path
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)
            f.write("\n")

        generated += 1

    emit(f"Done. processed={processed}, generated={generated}")
    return {"processed": processed, "generated": generated}


def main():
    generate_full_previews()


if __name__ == "__main__":
    main()

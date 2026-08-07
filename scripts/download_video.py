#!/usr/bin/env python3
"""
Download a YouTube/Vimeo video, split into ≤100MB chunks for GitHub storage.
Usage:
    python scripts/download_video.py <url> --work-name <name>
    python scripts/download_video.py <url>  # auto-named

Output: videos/uploads/<name>/source.part000, source.part001, ..., metadata.json

Set --chunk-size to change the max bytes per chunk (default 100MB).
Set --keep-source to retain the original source.mp4 (not committed).
"""

import subprocess
import sys
import os
import json
import re
import glob
import time
import argparse
import shutil

CHUNK_SIZE_DEFAULT = 100 * 1024 * 1024  # 100 MB

# Output always lands in <project root>/videos/uploads, independent of the
# process working directory (the CMS server may be launched from anywhere).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def find_ffmpeg():
    """Locate ffmpeg via FFMPEG_PATH env, PATH, known system path, or imageio-ffmpeg."""
    env_path = os.environ.get("FFMPEG_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path
    which = shutil.which("ffmpeg")
    if which:
        return which
    known = r"G:\tools\ffmpeg\ffmpeg-8.1.2-essentials_build\bin\ffmpeg.exe"
    if os.path.isfile(known):
        return known
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _has_decodable_video_stream(path, ffmpeg):
    """Quick sanity check: can ffmpeg actually decode this as video at all?
    Without this, an upload of the wrong file type (e.g. a renamed .txt)
    silently makes it all the way through ensure_faststart/create_index_preview
    - both of which treat ffmpeg failures as non-fatal warnings, by design,
    so a genuinely valid video that merely fails the faststart optimization
    still succeeds - and the job reports "done" with a metadata.json full of
    chunks pointing at unplayable garbage. This catches that class of input
    before any of that runs, so it fails loudly instead."""
    try:
        result = subprocess.run(
            [ffmpeg, "-v", "error", "-i", path, "-t", "0.1", "-f", "null", "-"],
            capture_output=True,
        )
        return result.returncode == 0
    except Exception:
        return False


def check_dependencies():
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        raise RuntimeError(
            "Missing required tool: yt-dlp. Install with: pip install yt-dlp"
        )
    if not find_ffmpeg():
        raise RuntimeError(
            "Missing required tool: ffmpeg (needed to merge YouTube video+audio). "
            "Add ffmpeg to PATH, set FFMPEG_PATH to the ffmpeg.exe location, "
            "or run: pip install imageio-ffmpeg"
        )


def split_binary(filepath, chunk_size, output_base=None):
    chunks = []
    base = output_base or filepath
    part_num = 0
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            chunk_path = f"{base}.part{part_num:03d}"
            with open(chunk_path, "wb") as cf:
                cf.write(chunk)
            chunks.append({
                "path": os.path.basename(chunk_path),
                "size": len(chunk),
                "index": part_num
            })
            part_num += 1
    return chunks


def _find_source_file(output_dir):
    """Locate the final merged source file after a successful download."""
    candidates = []
    for p in glob.glob(os.path.join(output_dir, "source.*")):
        name = os.path.basename(p)
        if re.search(r"\.f\d+\.", name) or ".temp." in name or name.endswith(".part"):
            continue
        candidates.append(p)
    if not candidates:
        raise RuntimeError(
            "Download finished but no source file was found. "
            "A YouTube merge may have failed; check the server log."
        )
    return max(candidates, key=os.path.getsize)


def _resolve_local_source(url):
    """If url is a local video file path (absolute or repo-relative), return it."""
    if not url or url.startswith(("http://", "https://")):
        return None
    candidates = []
    if os.path.isabs(url):
        candidates.append(url)
    else:
        candidates.append(os.path.join(PROJECT_ROOT, url))
        candidates.append(url)
    for p in candidates:
        if os.path.isfile(p):
            return os.path.abspath(p)
    return None


def remux_to_mp4(source_mp4, output_dir, report, target_name="source.mp4"):
    """YouTube best-format merges can land in a .mkv container, which most
    browsers (and Safari in particular) refuse to play. Remux to .mp4."""
    if not source_mp4.lower().endswith(".mkv"):
        return source_mp4
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        report("Warning: .mkv download cannot be remuxed (no ffmpeg found).")
        return source_mp4
    target = os.path.join(output_dir, target_name)
    cmd = [ffmpeg, "-y", "-i", source_mp4, "-c", "copy", "-movflags", "faststart", target]
    subprocess.run(cmd, check=True)
    os.remove(source_mp4)
    report(f"Remuxed {os.path.basename(source_mp4)} -> {os.path.basename(target)}")
    return target


def ensure_faststart(source_path, output_dir, report, target_name):
    """Remux (stream copy, no re-encode) so the moov atom sits at the front
    of the file. Many exporters (and ffmpeg's own default one-pass mode)
    write moov at the end instead, which is fine for a single fully
    downloaded file but breaks byte-range chunk splitting: a prefix
    consisting of the first chunk(s) alone wouldn't contain the moov atom
    yet and so couldn't be decoded/played until every chunk had downloaded.
    With faststart, the browser can start decoding as soon as the first
    chunk (which now contains ftyp+moov) is available."""
    ext = os.path.splitext(source_path)[1].lower()
    if ext not in (".mp4", ".mov", ".m4v"):
        return source_path

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        report("Warning: no ffmpeg found, cannot guarantee fast-start layout for chunked playback.")
        return source_path

    target = os.path.join(output_dir, target_name)
    cmd = [ffmpeg, "-y", "-i", source_path, "-c", "copy", "-movflags", "+faststart", target]
    try:
        subprocess.run(cmd, check=True)
    except Exception as exc:
        report(f"Warning: fast-start remux failed ({exc}); chunked playback may not start until fully downloaded.")
        return source_path

    report("Remuxed source for fast-start (lets chunked playback start on the first chunk).")
    return target


def create_index_preview(source_path, output_dir, report, target_name="preview_360p.mp4"):
    """Create a lightweight preview video for index hover playback.
    Trims the original to 30 seconds and keeps enough quality for smooth streaming."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        report("Warning: no ffmpeg found, skipped compressed index preview generation.")
        return ""

    target = os.path.join(output_dir, target_name)
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        source_path,
        "-t",
        "30",
        "-an",
        "-vf",
        "fps=24,scale=if(gte(iw\\,ih)\\,min(iw\\,960)\\,-2):if(gte(iw\\,ih)\\,-2\\,min(ih\\,960))",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "main",
        "-level",
        "4.0",
        "-crf",
        "30",
        "-maxrate",
        "1600k",
        "-bufsize",
        "3200k",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-movflags",
        "+faststart",
        target,
    ]

    try:
        subprocess.run(cmd, check=True)
    except Exception as exc:
        report(f"Warning: compressed index preview generation failed ({exc}).")
        return ""

    report(f"Generated compressed index preview: {os.path.basename(target)}")
    return os.path.basename(target)


def create_full_preview(source_path, output_dir, report, target_name="preview_full.mp4"):
    """Full-length, low-bitrate proxy (unlike create_index_preview, this
    covers the whole video, not just 30s). Multi-chunk sources stream
    progressively from the start, so seeking far ahead of what's downloaded
    can't be instant - this proxy is what the player jumps to instead
    (single small file, fast to seek within), like YouTube dropping to a
    lower quality while catching up. ~45KB/s (~2.7MB/min) keeps a typical
    portfolio-length video safely under GitHub's 100MB file limit."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        report("Warning: no ffmpeg found, skipped full-length seek preview generation.")
        return ""

    target = os.path.join(output_dir, target_name)
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        source_path,
        "-vf",
        "fps=24,scale=if(gte(iw\\,ih)\\,min(iw\\,960)\\,-2):if(gte(iw\\,ih)\\,-2\\,min(ih\\,960))",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "main",
        "-level",
        "4.0",
        "-crf",
        "32",
        "-maxrate",
        "600k",
        "-bufsize",
        "1200k",
        "-g",
        "48",
        "-keyint_min",
        "48",
        "-sc_threshold",
        "0",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-movflags",
        "+faststart",
        target,
    ]

    try:
        subprocess.run(cmd, check=True)
    except Exception as exc:
        report(f"Warning: full-length seek preview generation failed ({exc}).")
        return ""

    size_mb = os.path.getsize(target) / 1024 / 1024
    report(f"Generated full-length seek preview: {os.path.basename(target)} ({size_mb:.1f} MB)")
    return os.path.basename(target)


def download_and_split(url, work_name, chunk_size=CHUNK_SIZE_DEFAULT,
                       keep_source=False, progress=None):
    """Download a video (or use a local file) and split it into chunks."""
    def report(message):
        if progress:
            progress(message)

    videos_dir = os.path.join(PROJECT_ROOT, "videos", "uploads")
    os.makedirs(videos_dir, exist_ok=True)

    if not work_name:
        work_name = f"video_{len(os.listdir(videos_dir)) + 1}"
    work_name = re.sub(r"[^a-zA-Z0-9_-]+", "-", work_name).strip("-") or "video"

    output_dir = os.path.join(videos_dir, work_name)
    os.makedirs(output_dir, exist_ok=True)
    artifact_stamp = str(int(time.time() * 1000))
    artifact_stem = f"source-{artifact_stamp}"
    preview_name = f"preview_360p-{artifact_stamp}.mp4"
    source_artifact_path = None

    # Convert regular Vimeo URLs to embed format (avoids OAuth 401)
    vm_match = re.match(r"https?://(?:www\.)?vimeo\.com/(\d+)", url)
    if vm_match:
        url = f"https://player.vimeo.com/video/{vm_match.group(1)}"
        report(f"Converted Vimeo URL to embed: {url}")

    local_source = _resolve_local_source(url)
    if local_source:
        ext = os.path.splitext(local_source)[1] or ".mp4"
        source_mp4 = local_source
        source_artifact_path = os.path.join(output_dir, artifact_stem + ext)
        report(
            f"Using local file {os.path.basename(local_source)} "
            f"without overwriting existing artifacts ..."
        )
        report(f"Downloaded: {os.path.getsize(source_mp4) / 1024 / 1024:.1f} MB")
    else:
        check_dependencies()
        source_template = os.path.join(output_dir, artifact_stem + ".%(ext)s")

        report(f"Downloading {url} ...")
        cmd = [
            sys.executable,
            "-m", "yt_dlp",
            "-f", "bv*+ba/b",
            "-o", source_template,
        ]
        ffmpeg_path = find_ffmpeg()
        if ffmpeg_path:
            cmd += ["--ffmpeg-location", os.path.dirname(ffmpeg_path)]
        js_runtime = shutil.which("node") or shutil.which("deno")
        if js_runtime:
            runtime_name = "node" if os.path.basename(js_runtime).lower().startswith("node") else "deno"
            cmd += ["--js-runtimes", runtime_name, "--remote-components", "ejs:github"]
        cmd.append(url)
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                subprocess.run(cmd, check=True)
                break
            except subprocess.CalledProcessError:
                if attempt == max_attempts:
                    raise
                report(f"Attempt {attempt} failed; retrying in 5s ...")
                time.sleep(5)

        source_mp4 = _find_source_file(output_dir)
        source_mp4 = remux_to_mp4(
            source_mp4,
            output_dir,
            report,
            target_name=artifact_stem + ".mp4",
        )
        source_artifact_path = source_mp4
        report(f"Downloaded: {os.path.getsize(source_mp4) / 1024 / 1024:.1f} MB")

    ffmpeg_for_check = find_ffmpeg()
    if ffmpeg_for_check and not _has_decodable_video_stream(source_mp4, ffmpeg_for_check):
        raise RuntimeError(
            f"'{os.path.basename(source_mp4)}' doesn't look like a valid, "
            "decodable video (ffmpeg couldn't read a video stream from it)."
        )

    faststarted_mp4 = ensure_faststart(source_mp4, output_dir, report, target_name=artifact_stem + "-fs.mp4")
    if faststarted_mp4 != source_mp4:
        old_source_mp4 = source_mp4
        source_mp4 = faststarted_mp4
        source_artifact_path = source_mp4
        # Only clean up artifacts we created inside output_dir (e.g. a
        # downloaded/remuxed source) - never the caller's external temp
        # upload file, which the caller owns and cleans up itself.
        if os.path.dirname(os.path.abspath(old_source_mp4)) == os.path.abspath(output_dir):
            try:
                os.remove(old_source_mp4)
            except OSError:
                pass

    total_size = os.path.getsize(source_mp4)
    index_preview = create_index_preview(source_mp4, output_dir, report, target_name=preview_name)

    # Only needed for multi-chunk sources: the player streams chunks
    # progressively from the start, so seeking ahead of what's downloaded
    # jumps to this small full-length proxy instead of stalling.
    full_preview = ""
    if total_size > chunk_size:
        full_preview = create_full_preview(
            source_mp4, output_dir, report, target_name=f"preview_full-{artifact_stamp}.mp4"
        )

    if total_size <= chunk_size:
        if source_artifact_path is None:
            ext = os.path.splitext(source_mp4)[1] or ".mp4"
            source_artifact_path = os.path.join(output_dir, artifact_stem + ext)
        if os.path.abspath(source_mp4) != os.path.abspath(source_artifact_path):
            report(
                "Copying processed source into work folder as "
                f"{os.path.basename(source_artifact_path)} ..."
            )
            shutil.copy2(source_mp4, source_artifact_path)
        report("File fits in a single chunk, no split needed.")
        chunks = [{
            "path": os.path.basename(source_artifact_path),
            "size": total_size,
            "index": 0
        }]
    else:
        report(f"Splitting into {chunk_size / 1024 / 1024:.0f} MB chunks ...")
        if source_artifact_path is None:
            ext = os.path.splitext(source_mp4)[1] or ".mp4"
            source_artifact_path = os.path.join(output_dir, artifact_stem + ext)
        chunks = split_binary(source_mp4, chunk_size, output_base=source_artifact_path)

    for c in chunks:
        p = os.path.join(output_dir, c["path"])
        c["size"] = os.path.getsize(p)

    metadata = {
        "source_url": url,
        "work_name": work_name,
        "total_size": total_size,
        "index_preview": index_preview,
        "full_preview": full_preview,
        "chunk_size": chunk_size,
        "num_chunks": len(chunks),
        "chunks": chunks
    }

    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    if (
        not keep_source
        and total_size > chunk_size
        and source_artifact_path
        and os.path.isfile(source_artifact_path)
    ):
        os.remove(source_artifact_path)

    report(f"Done. {len(chunks)} chunk(s), {total_size / 1024 / 1024:.1f} MB total.")
    metadata["preview_path"] = f"videos/uploads/{work_name}/metadata.json"
    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="Download a video and split into ≤100MB chunks for GitHub."
    )
    parser.add_argument("url", help="YouTube, Vimeo, or other yt-dlp compatible URL")
    parser.add_argument("--work-name", "-n", help="Name for the output folder (slug)")
    parser.add_argument(
        "--chunk-size", "-s",
        type=int,
        default=CHUNK_SIZE_DEFAULT,
        help=f"Max bytes per chunk (default {CHUNK_SIZE_DEFAULT})"
    )
    parser.add_argument("--keep-source", action="store_true",
                        help="Keep the original source.mp4 after splitting")
    args = parser.parse_args()

    def print_progress(message):
        print(message)

    try:
        metadata = download_and_split(
            args.url,
            args.work_name,
            chunk_size=args.chunk_size,
            keep_source=args.keep_source,
            progress=print_progress
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"\nStored in videos/uploads/{metadata['work_name']}/")
    for c in metadata["chunks"]:
        print(f"    {c['path']}: {c['size'] / 1024 / 1024:.1f} MB")
    if not args.keep_source and metadata["num_chunks"] > 1:
        print("  (source.mp4 removed; only chunks kept)")
    print(f"\nSet data-preview to: {metadata['preview_path']}")


if __name__ == "__main__":
    main()

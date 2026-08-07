/* Serves the chunked work videos as one seekable virtual file.

   scripts/download_video.py splits large sources into <100MB parts
   (videos/uploads/<work>/source-<stamp>.mp4.partNNN) to stay under GitHub's
   per-file limit. Those parts are plain contiguous byte ranges of the
   original file, so this worker can present them back to the browser as a
   single file at videos/uploads/<work>/__stream__.mp4 and translate the
   browser's HTTP Range requests into ranged fetches of the parts they
   actually land in.

   The <video> element then behaves exactly as it would with any normal
   progressive MP4: seeking anywhere fetches only the bytes around the seek
   target, the browser buffers ahead by itself, and nothing has to be held
   in page memory. */

var STREAM_SUFFIX = '/__stream__.mp4';
// Cap how much a single Range response serves. The browser keeps asking for
// more as playback needs it, so this bounds memory/latency per request
// without limiting how much can be buffered overall.
var MAX_SLICE = 8 * 1024 * 1024;

var metaCache = new Map();

self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

function mimeForChunk(path) {
    // "source-<stamp>.mp4.part003" -> mp4
    var base = (path || '').split('?')[0].replace(/\.part\d+$/i, '');
    var ext = (base.split('.').pop() || 'mp4').toLowerCase();
    if (ext === 'webm') return 'video/webm';
    if (ext === 'ogg') return 'video/ogg';
    if (ext === 'mkv') return 'video/x-matroska';
    return 'video/mp4';
}

/* Builds the absolute-offset map of the parts once per work folder, so a
   byte position can be resolved to (part, offset within part). */
function loadMeta(basePath) {
    // Caches the in-flight promise as well as the result, so the burst of
    // range requests a <video> opens with shares one metadata fetch.
    var cached = metaCache.get(basePath);
    if (cached) return Promise.resolve(cached);

    var pending = fetch(basePath + 'metadata.json')
        .then(function (response) {
            if (!response.ok) throw new Error('metadata.json ' + response.status);
            return response.json();
        })
        .then(function (meta) {
            var offset = 0;
            var parts = (meta.chunks || []).map(function (chunk) {
                var entry = { path: chunk.path, start: offset, size: chunk.size };
                offset += chunk.size;
                return entry;
            });
            if (!parts.length) throw new Error('no chunks in metadata.json');
            var info = { parts: parts, total: offset, mime: mimeForChunk(parts[0].path) };
            metaCache.set(basePath, info);
            return info;
        })
        .catch(function (err) {
            metaCache.delete(basePath);
            throw err;
        });

    metaCache.set(basePath, pending);
    return pending;
}

function parseRange(header, total) {
    if (!header) return null;
    var match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match) return null;

    var start;
    var end;
    if (match[1]) {
        start = parseInt(match[1], 10);
        end = match[2] ? parseInt(match[2], 10) : total - 1;
    } else if (match[2]) {
        start = Math.max(0, total - parseInt(match[2], 10));
        end = total - 1;
    } else {
        return null;
    }

    if (isNaN(start) || isNaN(end) || start > end || start >= total) return null;
    return { start: start, end: Math.min(end, total - 1) };
}

function findPart(parts, position) {
    for (var i = 0; i < parts.length; i += 1) {
        var part = parts[i];
        if (position >= part.start && position < part.start + part.size) {
            return part;
        }
    }
    return null;
}

/* Streams [start, end] inclusive, pulling one part-slice at a time so a
   large range never has to be assembled in memory up front. */
function sliceStream(basePath, parts, start, end) {
    var position = start;

    return new ReadableStream({
        pull: function (controller) {
            if (position > end) {
                controller.close();
                return;
            }

            var part = findPart(parts, position);
            if (!part) {
                controller.close();
                return;
            }

            var innerStart = position - part.start;
            var innerEnd = Math.min(part.size - 1, innerStart + (end - position));

            return fetch(basePath + part.path, {
                headers: { Range: 'bytes=' + innerStart + '-' + innerEnd }
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('chunk ' + part.path + ' ' + response.status);
                    }
                    return response.arrayBuffer().then(function (buffer) {
                        // A server that ignores Range answers 200 with the whole
                        // part; slice it ourselves so offsets stay correct.
                        return response.status === 206
                            ? buffer
                            : buffer.slice(innerStart, innerEnd + 1);
                    });
                })
                .then(function (buffer) {
                    if (!buffer.byteLength) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(new Uint8Array(buffer));
                    position += buffer.byteLength;
                    if (position > end) controller.close();
                })
                .catch(function (err) {
                    controller.error(err);
                });
        }
    });
}

function handleStream(basePath, request) {
    return loadMeta(basePath)
        .then(function (info) {
            var total = info.total;
            var range = parseRange(request.headers.get('Range'), total);

            // No Range header: hand back the whole file with a 200 (only a
            // Range request may be answered 206). The body still streams part
            // by part, so nothing is assembled in memory.
            if (!range) {
                return new Response(sliceStream(basePath, info.parts, 0, total - 1), {
                    status: 200,
                    headers: {
                        'Content-Type': info.mime,
                        'Content-Length': String(total),
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'no-store'
                    }
                });
            }

            var start = range.start;
            var end = Math.min(range.end, start + MAX_SLICE - 1);

            return new Response(sliceStream(basePath, info.parts, start, end), {
                status: 206,
                headers: {
                    'Content-Type': info.mime,
                    'Content-Length': String(end - start + 1),
                    'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'no-store'
                }
            });
        })
        .catch(function (err) {
            return new Response('video stream error: ' + err.message, { status: 500 });
        });
}

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;

    var url;
    try {
        url = new URL(event.request.url);
    } catch (e) {
        return;
    }

    if (url.origin !== self.location.origin) return;
    if (url.pathname.slice(-STREAM_SUFFIX.length) !== STREAM_SUFFIX) return;

    var basePath = url.pathname.slice(0, url.pathname.length - STREAM_SUFFIX.length + 1);
    event.respondWith(handleStream(basePath, event.request));
});

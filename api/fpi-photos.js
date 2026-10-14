// First Pull Indoor gallery: list, serve and upload photos stored in a private Vercel Blob store.
// Vercel sets BLOB_STORE_ID (and signs the function in automatically) when the store is connected.
// Set one more environment variable yourself:
//   GALLERY_UPLOAD_KEY  (the password used on the page to upload)
//
//   GET  /api/fpi-photos              -> { photos: [{ url, uploadedAt }] }
//   GET  /api/fpi-photos?file=<path>  -> the image itself (streamed from the private store)
//   POST /api/fpi-photos              -> upload one image (header x-upload-key required)
import { put, list, get } from '@vercel/blob';

const PREFIX = 'first-pull-indoor/';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function GET(request) {
  const file = new URL(request.url).searchParams.get('file');
  return file ? serveFile(file, request) : listPhotos();
}

async function listPhotos() {
  try {
    const photos = [];
    let cursor;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      photos.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    photos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return Response.json(
      {
        photos: photos.map((p) => ({
          url: '/api/fpi-photos?file=' + encodeURIComponent(p.pathname),
          uploadedAt: p.uploadedAt,
        })),
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (err) {
    console.error('fpi list failed', err);
    return Response.json({ photos: [], error: 'Photo storage is not set up yet.' }, { status: 503 });
  }
}

async function serveFile(pathname, request) {
  // Only serve files from this album.
  if (!pathname.startsWith(PREFIX) || pathname.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') || undefined,
    });
    if (!result) return new Response('Not found', { status: 404 });
    const cacheHeaders = { 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' };
    if (result.statusCode === 304) {
      return new Response(null, { status: 304, headers: { ...cacheHeaders, etag: result.blob?.etag || '' } });
    }
    return new Response(result.stream, {
      headers: { ...cacheHeaders, 'content-type': result.blob.contentType, etag: result.blob.etag },
    });
  } catch (err) {
    console.error('fpi get failed', err);
    return new Response('Not found', { status: 404 });
  }
}

export async function POST(request) {
  const key = process.env.GALLERY_UPLOAD_KEY;
  if (!key) {
    return Response.json({ error: 'Uploads are not enabled yet.' }, { status: 503 });
  }
  if (request.headers.get('x-upload-key') !== key) {
    return Response.json({ error: 'Wrong upload password.' }, { status: 401 });
  }
  const type = (request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) {
    return Response.json({ error: 'Only JPEG, PNG or WebP images can be uploaded.' }, { status: 415 });
  }
  const data = Buffer.from(await request.arrayBuffer());
  if (data.length === 0 || data.length > MAX_BYTES) {
    return Response.json({ error: 'Each photo must be under 4 MB.' }, { status: 413 });
  }
  try {
    const blob = await put(`${PREFIX}photo.${ext}`, data, {
      access: 'private',
      addRandomSuffix: true,
      contentType: type,
    });
    return Response.json({ url: '/api/fpi-photos?file=' + encodeURIComponent(blob.pathname) });
  } catch (err) {
    console.error('fpi put failed', err);
    return Response.json({ error: 'Upload failed. Photo storage may not be set up yet.' }, { status: 500 });
  }
}

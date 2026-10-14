// First Pull Indoor gallery: list and upload photos stored in Vercel Blob.
// Needs two environment variables in the Vercel project:
//   BLOB_READ_WRITE_TOKEN  (added automatically when a Blob store is connected)
//   GALLERY_UPLOAD_KEY     (the password used on the page to upload)
import { put, list } from '@vercel/blob';

const PREFIX = 'first-pull-indoor/';
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function GET() {
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
      { photos: photos.map((p) => ({ url: p.url, uploadedAt: p.uploadedAt })) },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (err) {
    return Response.json({ photos: [], error: 'Photo storage is not set up yet.' }, { status: 503 });
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
      access: 'public',
      addRandomSuffix: true,
      contentType: type,
    });
    return Response.json({ url: blob.url });
  } catch (err) {
    return Response.json({ error: 'Upload failed. Photo storage may not be set up yet.' }, { status: 500 });
  }
}

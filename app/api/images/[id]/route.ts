import { env } from 'cloudflare:workers';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { memoryImages } from '@/db/schema';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [image] = await getDb()
    .select({
      objectKey: memoryImages.objectKey,
      mimeType: memoryImages.mimeType,
    })
    .from(memoryImages)
    .where(and(eq(memoryImages.id, id), isNotNull(memoryImages.memoryId)))
    .limit(1);

  if (!image) {
    return Response.json({ error: '사진을 찾지 못했어요.' }, { status: 404 });
  }

  const object = await env.MEMORY_IMAGES.get(image.objectKey);
  if (!object) {
    return Response.json(
      { error: '사진 원본을 찾지 못했어요.' },
      { status: 404 },
    );
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': image.mimeType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(object.size),
    },
  });
}

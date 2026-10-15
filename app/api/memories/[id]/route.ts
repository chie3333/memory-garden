import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { memories, memoryImages } from '@/db/schema';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return Response.json(
      { error: '삭제할 기록을 찾지 못했어요.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const images = await db
    .select({ objectKey: memoryImages.objectKey })
    .from(memoryImages)
    .where(eq(memoryImages.memoryId, id));

  await db.delete(memories).where(eq(memories.id, id));
  await Promise.all(
    images.map((image) => env.MEMORY_IMAGES.delete(image.objectKey)),
  );
  return Response.json({ deleted: true, id });
}

import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { memories } from '@/db/schema';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: '삭제할 기록을 찾지 못했어요.' }, { status: 400 });
  }

  await getDb().delete(memories).where(eq(memories.id, id));
  return Response.json({ deleted: true, id });
}

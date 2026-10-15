import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { memories, memoryImages } from '@/db/schema';

const MAX_CONTENT_LENGTH = 50_000;

function makeTitle(content: string) {
  const firstUsefulLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstUsefulLine) return '제목 없는 기억';
  return firstUsefulLine.length > 42
    ? `${firstUsefulLine.slice(0, 42).trim()}…`
    : firstUsefulLine;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim().toLocaleLowerCase('ko') ?? '';
  const sourceType = url.searchParams.get('source')?.trim() ?? '';
  const db = getDb();

  const queryFilter = query
    ? or(
        like(memories.searchText, `%${query}%`),
        like(memories.title, `%${query}%`),
        like(memories.source, `%${query}%`),
      )
    : undefined;
  const sourceFilter = sourceType
    ? like(memories.sourceType, sourceType)
    : undefined;
  const where =
    queryFilter && sourceFilter
      ? and(queryFilter, sourceFilter)
      : (queryFilter ?? sourceFilter);

  const rows = await db
    .select()
    .from(memories)
    .where(where)
    .orderBy(desc(memories.createdAt))
    .limit(100);

  const imageRows = rows.length
    ? await db
        .select({ id: memoryImages.id, memoryId: memoryImages.memoryId })
        .from(memoryImages)
        .where(
          inArray(
            memoryImages.memoryId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  const imageByMemory = new Map(
    imageRows.flatMap((image) =>
      image.memoryId ? [[image.memoryId, image.id] as const] : [],
    ),
  );

  return Response.json({
    memories: rows.map((row) => ({
      ...row,
      imageId: imageByMemory.get(row.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: '기록 내용을 읽지 못했어요.' },
      { status: 400 },
    );
  }

  const content =
    typeof body === 'object' &&
    body &&
    'content' in body &&
    typeof body.content === 'string'
      ? body.content.trim()
      : '';
  const imageId =
    typeof body === 'object' &&
    body &&
    'imageId' in body &&
    typeof body.imageId === 'string'
      ? body.imageId.trim()
      : '';

  if (!content) {
    return Response.json({ error: '남길 내용을 적어주세요.' }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return Response.json(
      { error: '한 기록은 50,000자까지 남길 수 있어요.' },
      { status: 400 },
    );
  }

  const db = getDb();
  const pendingImage = imageId
    ? await db
        .select({ id: memoryImages.id })
        .from(memoryImages)
        .where(and(eq(memoryImages.id, imageId), isNull(memoryImages.memoryId)))
        .limit(1)
    : [];

  if (imageId && pendingImage.length === 0) {
    return Response.json(
      { error: '손글씨 사진 연결이 만료되었어요. 다시 읽어주세요.' },
      { status: 400 },
    );
  }

  const now = Date.now();
  const memory = {
    id: crypto.randomUUID(),
    title: makeTitle(content),
    content,
    source: imageId ? '손글씨 사진' : '내 기록',
    sourceType: imageId ? 'handwriting' : 'manual',
    sourceId: imageId || null,
    searchText: content.toLocaleLowerCase('ko'),
    createdAt: now,
    updatedAt: now,
  };

  if (imageId) {
    await db.batch([
      db.insert(memories).values(memory),
      db
        .update(memoryImages)
        .set({ memoryId: memory.id, correctedText: content, confirmedAt: now })
        .where(
          and(eq(memoryImages.id, imageId), isNull(memoryImages.memoryId)),
        ),
    ]);
  } else {
    await db.insert(memories).values(memory);
  }
  return Response.json(
    { memory: { ...memory, imageId: imageId || null } },
    { status: 201 },
  );
}

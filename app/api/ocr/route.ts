import { env } from 'cloudflare:workers';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { memoryImages } from '@/db/schema';
import {
  DEFAULT_VISION_MODEL,
  getOllamaStatus,
  OllamaError,
  transcribeHandwriting,
} from '@/lib/ollama';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function GET() {
  const status = await getOllamaStatus();
  return Response.json(status);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('image');

  if (!(file instanceof File)) {
    return Response.json(
      { error: '읽을 손글씨 사진을 골라주세요.' },
      { status: 400 },
    );
  }
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return Response.json(
      { error: 'JPG, PNG 또는 WebP 사진을 사용할 수 있어요.' },
      { status: 415 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: '사진은 10MB보다 작아야 해요.' },
      { status: 413 },
    );
  }

  const status = await getOllamaStatus();
  if (!status.available) {
    return Response.json(
      {
        error:
          'Ollama에 연결하지 못했어요. Ollama를 실행한 뒤 다시 시도해주세요.',
        code: 'OLLAMA_UNAVAILABLE',
        model: DEFAULT_VISION_MODEL,
      },
      { status: 503 },
    );
  }
  if (!status.installed) {
    return Response.json(
      {
        error: `${DEFAULT_VISION_MODEL} 모델이 아직 없어요. Ollama에서 모델을 내려받은 뒤 다시 시도해주세요.`,
        code: 'MODEL_MISSING',
        model: DEFAULT_VISION_MODEL,
      },
      { status: 422 },
    );
  }

  const image = await file.arrayBuffer();
  let ocrText: string;
  try {
    ocrText = await transcribeHandwriting(image);
  } catch (error) {
    if (error instanceof OllamaError) {
      return Response.json(
        { error: error.message, code: error.code, model: DEFAULT_VISION_MODEL },
        { status: error.code === 'OLLAMA_UNAVAILABLE' ? 503 : 422 },
      );
    }
    return Response.json(
      { error: '손글씨를 읽는 중 문제가 생겼어요.' },
      { status: 500 },
    );
  }

  const id = crypto.randomUUID();
  const objectKey = `handwriting/${id}`;
  const now = Date.now();

  await env.MEMORY_IMAGES.put(objectKey, image, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name.slice(0, 180) },
  });

  try {
    await getDb()
      .insert(memoryImages)
      .values({
        id,
        memoryId: null,
        objectKey,
        originalName: file.name.slice(0, 180) || 'handwriting',
        mimeType: file.type,
        size: file.size,
        ocrModel: DEFAULT_VISION_MODEL,
        ocrText,
        correctedText: null,
        createdAt: now,
        confirmedAt: null,
      });
  } catch (error) {
    await env.MEMORY_IMAGES.delete(objectKey);
    throw error;
  }

  return Response.json(
    {
      image: {
        id,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      },
      text: ocrText,
      model: DEFAULT_VISION_MODEL,
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim() ?? '';
  if (!id) {
    return Response.json(
      { error: '정리할 사진을 찾지 못했어요.' },
      { status: 400 },
    );
  }

  const [pending] = await getDb()
    .select({ id: memoryImages.id, objectKey: memoryImages.objectKey })
    .from(memoryImages)
    .where(and(eq(memoryImages.id, id), isNull(memoryImages.memoryId)))
    .limit(1);

  if (pending) {
    await env.MEMORY_IMAGES.delete(pending.objectKey);
    await getDb().delete(memoryImages).where(eq(memoryImages.id, pending.id));
  }

  return Response.json({ deleted: Boolean(pending), id });
}

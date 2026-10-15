const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_VISION_MODEL = 'qwen3-vl:8b';

type OllamaTagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

type OllamaChatResponse = {
  message?: { content?: string };
  error?: string;
};

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly code: 'OLLAMA_UNAVAILABLE' | 'MODEL_MISSING' | 'OCR_FAILED',
  ) {
    super(message);
  }
}

function normalizeBaseUrl(baseUrl = DEFAULT_BASE_URL) {
  return baseUrl.replace(/\/$/, '');
}

export async function getOllamaStatus(
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_VISION_MODEL,
) {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      return { available: false, installed: false, model };
    }

    const body = (await response.json()) as OllamaTagsResponse;
    const installed = (body.models ?? []).some((item) => {
      const name = item.model ?? item.name ?? '';
      return name === model || name === model.replace(/:latest$/, '');
    });
    return { available: true, installed, model };
  } catch {
    return { available: false, installed: false, model };
  }
}

export async function transcribeHandwriting(
  image: ArrayBuffer,
  model = DEFAULT_VISION_MODEL,
  baseUrl = DEFAULT_BASE_URL,
) {
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content:
              '이 사진에 사용자가 직접 쓴 손글씨를 줄바꿈까지 최대한 그대로 전사해 주세요. 요약하거나 내용을 보충하지 마세요. 확실히 읽히지 않는 부분은 억지로 추측하지 말고 [읽기 어려움]이라고 적어 주세요. 설명, 머리말, 마크다운 없이 전사한 본문만 출력하세요.',
            images: [Buffer.from(image).toString('base64')],
          },
        ],
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(300_000),
    });
  } catch {
    throw new OllamaError(
      'Ollama에 연결하지 못했어요. Ollama를 실행한 뒤 다시 시도해주세요.',
      'OLLAMA_UNAVAILABLE',
    );
  }

  let body: OllamaChatResponse = {};
  try {
    body = (await response.json()) as OllamaChatResponse;
  } catch {
    // The status and fallback message below are enough for a useful UI error.
  }

  if (!response.ok) {
    const modelMissing =
      response.status === 404 || /model.*not found/i.test(body.error ?? '');
    if (modelMissing) {
      throw new OllamaError(
        `${model} 모델이 아직 없어요. Ollama에서 모델을 내려받은 뒤 다시 시도해주세요.`,
        'MODEL_MISSING',
      );
    }
    throw new OllamaError(
      body.error ?? '손글씨를 읽는 중 문제가 생겼어요.',
      'OCR_FAILED',
    );
  }

  const text = body.message?.content?.trim() ?? '';
  if (!text) {
    throw new OllamaError(
      '사진에서 읽을 수 있는 글자를 찾지 못했어요.',
      'OCR_FAILED',
    );
  }
  return text;
}

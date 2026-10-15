'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Camera,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Feather,
  Flower2,
  ImageIcon,
  LoaderCircle,
  RotateCcw,
  Search,
  ServerOff,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Memory = {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceType: string;
  sourceId: string | null;
  searchText: string;
  createdAt: number;
  updatedAt: number;
  imageId: string | null;
};

type OcrStatus = {
  available: boolean;
  installed: boolean;
  model: string;
};

type ToolRegistration = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => Promise<unknown>;
};

type WebMcpDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: ToolRegistration,
      options?: { signal?: AbortSignal },
    ) => void | Promise<void>;
  };
};

const markerColors = ['sage', 'violet', 'amber'] as const;

function markerFor(id: string) {
  const sum = Array.from(id).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return markerColors[sum % markerColors.length];
}

function formatMemoryDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) {
    return `오늘 ${new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)}`;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? '잠시 후 다시 시도해주세요.';
  } catch {
    return '잠시 후 다시 시도해주세요.';
  }
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [composerMode, setComposerMode] = useState<'text' | 'handwriting'>(
    'text',
  );
  const [handwritingText, setHandwritingText] = useState('');
  const [handwritingImageId, setHandwritingImageId] = useState<string | null>(
    null,
  );
  const [handwritingPreview, setHandwritingPreview] = useState('');
  const [handwritingFileName, setHandwritingFileName] = useState('');
  const [ocrReading, setOcrReading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<OcrStatus | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');

  const loadMemories = useCallback(async (searchQuery = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const response = await fetch(`/api/memories?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as { memories: Memory[] };
      setMemories(body.memories);
      return body.memories;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadMemories(query).catch((error: unknown) => {
          setMessage(
            error instanceof Error
              ? error.message
              : '기억을 불러오지 못했어요.',
          );
        });
      },
      query ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [loadMemories, query]);

  const saveMemory = useCallback(async (content: string, imageId?: string) => {
    const response = await fetch('/api/memories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ content, imageId }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = (await response.json()) as { memory: Memory };
    setQuery('');
    setMemories((current) => [
      body.memory,
      ...current.filter((item) => item.id !== body.memory.id),
    ]);
    return body.memory;
  }, []);

  useEffect(() => {
    void fetch('/api/ocr', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (response.ok) setOcrStatus((await response.json()) as OcrStatus);
      })
      .catch(() =>
        setOcrStatus({
          available: false,
          installed: false,
          model: 'qwen3-vl:8b',
        }),
      );
  }, []);

  const replaceHandwritingPreview = useCallback((nextUrl: string) => {
    if (previewUrlRef.current && previewUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setHandwritingPreview(nextUrl);
  }, []);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || saving) return;

    setSaving(true);
    setMessage('');
    try {
      await saveMemory(draft.trim());
      setDraft('');
      setMessage('기억을 잘 보관했어요.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '기억을 저장하지 못했어요.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function discardPendingImage() {
    const pendingId = handwritingImageId;
    setHandwritingImageId(null);
    setHandwritingText('');
    setHandwritingFileName('');
    replaceHandwritingPreview('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (pendingId) {
      await fetch(`/api/ocr?id=${encodeURIComponent(pendingId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      }).catch(() => undefined);
    }
  }

  async function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || ocrReading) return;

    const previousId = handwritingImageId;
    if (previousId) {
      void fetch(`/api/ocr?id=${encodeURIComponent(previousId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
    }

    setHandwritingImageId(null);
    setHandwritingText('');
    setHandwritingFileName(file.name);
    replaceHandwritingPreview(URL.createObjectURL(file));
    setOcrReading(true);
    setMessage(
      '사진에서 손글씨를 읽고 있어요. 사진 크기에 따라 조금 걸릴 수 있어요.',
    );

    const form = new FormData();
    form.append('image', file);
    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: form,
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = (await response.json()) as {
        image: { id: string };
        text: string;
        model: string;
      };
      setHandwritingImageId(body.image.id);
      setHandwritingText(body.text);
      setOcrStatus({ available: true, installed: true, model: body.model });
      setMessage('손글씨 초안을 만들었어요. 틀린 부분을 고친 뒤 저장해주세요.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '손글씨를 읽지 못했어요.',
      );
      void fetch('/api/ocr', { headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (response.ok) setOcrStatus((await response.json()) as OcrStatus);
        })
        .catch(() => undefined);
    } finally {
      setOcrReading(false);
    }
  }

  async function handleHandwritingSubmit(
    event: React.SyntheticEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!handwritingText.trim() || !handwritingImageId || saving) return;

    setSaving(true);
    setMessage('');
    try {
      await saveMemory(handwritingText.trim(), handwritingImageId);
      setHandwritingImageId(null);
      setHandwritingText('');
      setHandwritingFileName('');
      replaceHandwritingPreview('');
      if (imageInputRef.current) imageInputRef.current.value = '';
      setMessage('손글씨 원본과 확인한 내용을 함께 보관했어요.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '손글씨 기록을 저장하지 못했어요.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(memory: Memory) {
    const confirmed = window.confirm(
      '이 기억을 삭제할까요? 삭제한 기록은 되돌릴 수 없어요.',
    );
    if (!confirmed) return;

    const response = await fetch(
      `/api/memories/${encodeURIComponent(memory.id)}`,
      {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      },
    );
    if (!response.ok) {
      setMessage(await readError(response));
      return;
    }

    setMemories((current) => current.filter((item) => item.id !== memory.id));
    setExpandedId(null);
    setMessage('기억을 삭제했어요.');
  }

  useEffect(() => {
    const context = (document as WebMcpDocument).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const register = async () => {
      await Promise.resolve(
        context.registerTool(
          {
            name: 'create_memory',
            title: '기억 남기기',
            description:
              '사용자가 제공한 텍스트를 기억 정원사에 새 기록으로 저장합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', minLength: 1, maxLength: 50000 },
              },
              required: ['content'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            async execute(input) {
              const content =
                typeof input === 'object' &&
                input &&
                'content' in input &&
                typeof input.content === 'string'
                  ? input.content.trim()
                  : '';
              if (!content)
                throw new Error('content must be a non-empty string');
              const memory = await saveMemory(content);
              return { id: memory.id, title: memory.title, saved: true };
            },
          },
          { signal: lifecycle.signal },
        ),
      );

      await Promise.resolve(
        context.registerTool(
          {
            name: 'search_memories',
            title: '기억 검색하기',
            description:
              '제목, 원문, 출처에서 주어진 단어나 문장이 포함된 기억을 찾습니다.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', minLength: 1, maxLength: 200 },
              },
              required: ['query'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            async execute(input) {
              const searchQuery =
                typeof input === 'object' &&
                input &&
                'query' in input &&
                typeof input.query === 'string'
                  ? input.query.trim()
                  : '';
              if (!searchQuery)
                throw new Error('query must be a non-empty string');
              setQuery(searchQuery);
              const results = await loadMemories(searchQuery);
              return { query: searchQuery, resultCount: results.length };
            },
          },
          { signal: lifecycle.signal },
        ),
      );
    };

    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [loadMemories, saveMemory]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return memories.filter((memory) => {
      const date = new Date(memory.createdAt);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }).length;
  }, [memories]);
  const handwritingCount = useMemo(
    () =>
      memories.filter((memory) => memory.sourceType === 'handwriting').length,
    [memories],
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px]">
        <aside className="hidden w-[244px] shrink-0 border-r border-border/70 px-5 py-7 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2">
            <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Flower2 className="size-5" />
            </span>
            <div>
              <p className="font-heading text-[17px] font-semibold tracking-[-0.02em]">
                기억 정원사
              </p>
              <p className="text-xs text-muted-foreground">
                정리하지 않아도 괜찮게
              </p>
            </div>
          </div>

          <nav className="mt-10 space-y-1" aria-label="주요 메뉴">
            <button className="nav-item nav-item-active" type="button">
              <Archive />
              모든 기억
              <span className="ml-auto text-xs opacity-60">
                {memories.length}
              </span>
            </button>
            <button className="nav-item" type="button" disabled>
              <CalendarDays />
              시간별 보기
              <span className="ml-auto text-[10px] opacity-50">곧</span>
            </button>
            <button className="nav-item" type="button" disabled>
              <Sparkles />
              자동으로 모인 주제
              <span className="ml-auto text-[10px] opacity-50">곧</span>
            </button>
          </nav>

          <div className="mt-auto rounded-2xl border border-primary/10 bg-primary/[0.045] p-4">
            <p className="text-xs font-semibold text-primary">
              원문 그대로 보관
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              기록할 때는 분류하지 않아도 돼요. 날짜와 출처는 자동으로 남아요.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-8 lg:px-12 lg:py-9">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 lg:hidden">
                <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Flower2 className="size-4" />
                </span>
                <span className="font-heading font-semibold">기억 정원사</span>
              </div>
              <p className="eyebrow">나의 수집함</p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                아무렇게나 남겨도 괜찮아요
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                지금 떠오른 것을 적어두면 날짜와 출처는 알아서 정리해둘게요.
              </p>
            </div>
            <Badge
              variant="outline"
              className="hidden h-7 border-primary/15 bg-primary/[0.035] px-3 text-primary sm:inline-flex"
            >
              이 기기에 저장
            </Badge>
          </header>

          <form
            className="composer-card"
            onSubmit={
              composerMode === 'text' ? handleSubmit : handleHandwritingSubmit
            }
            aria-labelledby="composer-title"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Feather className="size-4" />
              </span>
              <div>
                <h2 id="composer-title" className="text-sm font-semibold">
                  지금의 기억
                </h2>
                <p className="text-xs text-muted-foreground">
                  제목도 태그도 필요 없어요
                </p>
              </div>
            </div>

            <div
              className="mt-4 inline-flex rounded-xl bg-secondary/70 p-1"
              aria-label="입력 방식"
            >
              <button
                type="button"
                className={`composer-mode ${composerMode === 'text' ? 'composer-mode-active' : ''}`}
                onClick={() => setComposerMode('text')}
              >
                <Feather />
                텍스트
              </button>
              <button
                type="button"
                className={`composer-mode ${composerMode === 'handwriting' ? 'composer-mode-active' : ''}`}
                onClick={() => setComposerMode('handwriting')}
              >
                <Camera />
                손글씨 사진
              </button>
            </div>

            {composerMode === 'text' ? (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="생각나는 대로 적어보세요…"
                className="mt-4 min-h-28 resize-none border-0 bg-transparent px-0 text-[15px] leading-7 shadow-none focus-visible:ring-0"
                maxLength={50000}
                aria-label="새 기억 내용"
              />
            ) : (
              <div className="mt-4">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => void handleImageSelection(event)}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/45 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    {ocrStatus?.available && ocrStatus.installed ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : (
                      <ServerOff className="size-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">
                      {ocrStatus === null
                        ? '로컬 OCR 확인 중'
                        : ocrStatus.available && ocrStatus.installed
                          ? '로컬 OCR 준비됨'
                          : ocrStatus.available
                            ? 'OCR 모델 받기 필요'
                            : 'Ollama 실행 필요'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {ocrStatus?.model ?? 'qwen3-vl:8b'} · 사진은 이 기기에만
                    저장
                  </span>
                </div>

                {!handwritingPreview ? (
                  <button
                    type="button"
                    className="mt-3 grid min-h-40 w-full place-items-center rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-6 text-center transition-colors hover:bg-primary/[0.055]"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <span>
                      <ImageIcon className="mx-auto size-6 text-primary/75" />
                      <span className="mt-3 block text-sm font-medium">
                        손글씨 사진 고르기
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        휴대폰에서는 바로 촬영할 수도 있어요 · JPG, PNG, WebP ·
                        최대 10MB
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/40">
                      <Image
                        src={handwritingPreview}
                        alt="선택한 손글씨 사진 미리보기"
                        width={720}
                        height={960}
                        unoptimized
                        className="h-48 w-full object-cover sm:h-full sm:min-h-56"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm"
                        onClick={() => void discardPendingImage()}
                        aria-label="선택한 사진 취소"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {handwritingFileName}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={ocrReading}
                        >
                          <RotateCcw />
                          다른 사진
                        </Button>
                      </div>
                      {ocrReading ? (
                        <div className="mt-3 grid min-h-44 place-items-center rounded-2xl bg-secondary/45 text-center">
                          <span>
                            <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
                            <span className="mt-3 block text-xs text-muted-foreground">
                              손글씨를 읽고 있어요
                            </span>
                          </span>
                        </div>
                      ) : handwritingImageId ? (
                        <>
                          <label
                            htmlFor="handwriting-text"
                            className="mt-3 block text-xs font-semibold"
                          >
                            읽어낸 내용 · 틀린 부분을 고쳐주세요
                          </label>
                          <Textarea
                            id="handwriting-text"
                            value={handwritingText}
                            onChange={(event) =>
                              setHandwritingText(event.target.value)
                            }
                            className="mt-2 min-h-40 resize-y bg-background/65 text-sm leading-6"
                            maxLength={50000}
                          />
                        </>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs leading-5 text-muted-foreground">
                          Ollama를 실행하고 qwen3-vl:8b 모델을 준비한 뒤 사진을
                          다시 골라주세요.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">
                오늘 · {composerMode === 'text' ? '내 기록' : '손글씨 사진'}
              </span>
              <Button
                type="submit"
                disabled={
                  composerMode === 'text'
                    ? !draft.trim() || saving
                    : !handwritingText.trim() ||
                      !handwritingImageId ||
                      ocrReading ||
                      saving
                }
                className="rounded-xl px-4"
              >
                {saving ? <LoaderCircle className="animate-spin" /> : null}
                {saving
                  ? '보관하는 중'
                  : composerMode === 'text'
                    ? '기억 남기기'
                    : '확인하고 저장'}
              </Button>
            </div>
            {message ? (
              <output
                className="mt-3 block text-xs text-muted-foreground"
                aria-live="polite"
              >
                {message}
              </output>
            ) : null}
          </form>

          <section className="mt-10" aria-labelledby="archive-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">다시 만나기</p>
                <div className="flex items-baseline gap-2">
                  <h2
                    id="archive-title"
                    className="mt-1 font-heading text-2xl font-semibold tracking-[-0.025em]"
                  >
                    모든 기억
                  </h2>
                  {!loading ? (
                    <span className="text-xs text-muted-foreground">
                      {memories.length}개
                    </span>
                  ) : null}
                </div>
              </div>
              <label
                htmlFor="memory-search"
                className="relative block w-full sm:w-[320px]"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="memory-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="기억 속 단어나 문장 찾기"
                  className="h-11 rounded-2xl border-border/70 bg-card pl-10 shadow-sm"
                  aria-label="기억 검색"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3" aria-busy={loading}>
              {loading ? (
                <div className="grid place-items-center rounded-3xl border border-border/60 bg-card/50 py-16">
                  <LoaderCircle className="size-5 animate-spin text-primary" />
                  <p className="mt-3 text-xs text-muted-foreground">
                    기억을 불러오고 있어요
                  </p>
                </div>
              ) : null}

              {!loading &&
                memories.map((memory) => {
                  const expanded = expandedId === memory.id;
                  const marker = markerFor(memory.id);
                  return (
                    <article key={memory.id} className="memory-card group">
                      <span
                        className={`memory-marker memory-marker-${marker}`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 text-left"
                          onClick={() =>
                            setExpandedId(expanded ? null : memory.id)
                          }
                          aria-expanded={expanded}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className="font-heading text-base font-semibold tracking-[-0.015em]">
                                {memory.title}
                              </h3>
                              <span className="text-xs text-muted-foreground">
                                {formatMemoryDate(memory.createdAt)}
                              </span>
                            </div>
                            <p
                              className={`mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground ${expanded ? '' : 'line-clamp-2'}`}
                            >
                              {memory.content}
                            </p>
                            <Badge
                              variant="secondary"
                              className="mt-3 bg-secondary/75 font-normal"
                            >
                              {memory.source}
                            </Badge>
                          </div>
                          <ChevronDown
                            className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {expanded ? (
                          <div className="mt-4 border-t border-border/50 pt-3">
                            {memory.imageId ? (
                              <a
                                href={`/api/images/${encodeURIComponent(memory.imageId)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-3 block w-fit overflow-hidden rounded-xl border border-border/60 bg-muted/30"
                              >
                                <Image
                                  src={`/api/images/${encodeURIComponent(memory.imageId)}`}
                                  alt="보관된 손글씨 원본"
                                  width={960}
                                  height={1280}
                                  unoptimized
                                  className="max-h-72 max-w-full object-contain sm:max-w-md"
                                />
                              </a>
                            ) : null}
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => void deleteMemory(memory)}
                              >
                                <Trash2 />
                                삭제
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}

              {!loading && memories.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
                  {query ? (
                    <Search className="mx-auto size-5 text-muted-foreground" />
                  ) : (
                    <Feather className="mx-auto size-5 text-muted-foreground" />
                  )}
                  <p className="mt-3 text-sm font-medium">
                    {query
                      ? '아직 맞는 기억을 찾지 못했어요'
                      : '첫 기억을 남겨보세요'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {query
                      ? '다른 단어나 짧은 문장으로 찾아보세요.'
                      : '제목과 분류는 기억 정원사가 맡을게요.'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="hidden w-[276px] shrink-0 border-l border-border/70 px-7 py-9 xl:block">
          <p className="eyebrow">자동으로 정리된 모습</p>
          <h2 className="mt-1 font-heading text-lg font-semibold">
            기억의 갈래
          </h2>
          <div className="mt-5 space-y-3">
            <div className="branch-card">
              <span className="branch-dot bg-[#95aa86]" />
              <div>
                <p className="text-sm font-medium">내가 직접 남긴 기록</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  기억 {memories.length}개
                </p>
              </div>
            </div>
            <div className="branch-card">
              <span className="branch-dot bg-[#d3a55f]" />
              <div>
                <p className="text-sm font-medium">이번 달의 기록</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  기억 {thisMonthCount}개
                </p>
              </div>
            </div>
            <div className="branch-card">
              <span className="branch-dot bg-[#9582aa]" />
              <div>
                <p className="text-sm font-medium">손글씨에서 온 기록</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  기억 {handwritingCount}개
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-3xl bg-[#f1ede5] p-5">
            <Flower2 className="size-5 text-[#776b57]" />
            <p className="mt-3 font-heading text-sm font-semibold text-[#4c453a]">
              정리는 나중에 자라나요
            </p>
            <p className="mt-1.5 text-xs leading-5 text-[#766f64]">
              처음에는 모두 수집함에 두고, 비슷한 기억이 쌓이면 자연스럽게
              갈래를 만들어요.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

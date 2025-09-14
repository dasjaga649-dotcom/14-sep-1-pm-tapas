import { api } from './client';

export type ChatRequest = {
  sessionId: string;
  userPrompt: string;
};

export type ChatResponse = {
  reply?: string;
  [key: string]: unknown;
};

export type ChatResult = {
  data: ChatResponse | string;
  contentType?: string;
  headers: Record<string, unknown>;
};

export async function sendChat(payload: ChatRequest): Promise<ChatResult> {
  const res = await api.post('/chat', payload);
  const contentType = typeof res.headers?.['content-type'] === 'string' ? String(res.headers['content-type']) : undefined;
  return { data: res.data as ChatResponse | string, contentType, headers: res.headers as Record<string, unknown> };
}

import { appConfig } from '@/config/appConfig';

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Centralised HTTP client for the FastAPI backend. In `mock` mode the client is
 * never called; `remoteOrLocal` transparently falls back to the in-browser
 * synthetic layer so that the UI has a single code path.
 */
export async function request<T>(
  path: string,
  init: RequestInit & { params?: Record<string, unknown> } = {},
): Promise<T> {
  const url = new URL(`${appConfig.apiBaseUrl}${path}`);
  if (init.params) {
    Object.entries(init.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: ApiError = { status: res.status, code: 'http_error', message: res.statusText };
    try {
      body = { ...body, ...(await res.json()) };
    } catch {
      /* non-JSON error body */
    }
    throw body;
  }
  return (await res.json()) as T;
}

export async function remoteOrLocal<T>(
  path: string,
  params: Record<string, unknown>,
  local: () => T,
): Promise<T> {
  if (appConfig.dataSource !== 'api') return local();
  try {
    return await request<T>(path, { params });
  } catch {
    // Backend unavailable: keep the demonstration usable with synthetic data.
    return local();
  }
}

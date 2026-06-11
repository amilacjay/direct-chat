import { useAuthStore } from '../store/auth';

const BASE = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  overrideToken?: string
): Promise<T> {
  const token = overrideToken ?? useAuthStore.getState().token;
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const json = await response.json();
      msg = json.detail ?? json.message ?? msg;
    } catch {
      // ignore parse error
    }
    throw new ApiError(response.status, msg);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, overrideToken?: string) =>
    request<T>(path, { method: 'GET' }, overrideToken),

  post: <T>(path: string, body?: unknown, overrideToken?: string) =>
    request<T>(
      path,
      {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      overrideToken
    ),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  postForm: <T>(path: string, formData: FormData, overrideToken?: string) =>
    request<T>(
      path,
      {
        method: 'POST',
        body: formData,
      },
      overrideToken
    ),

  putForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'PUT', body: formData }),

  getBlob: async (path: string): Promise<Blob> => {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE}${path}`, { headers });
    if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);
    return response.blob();
  },
};

export { BASE };

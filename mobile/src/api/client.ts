import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Resolution order:
 * 1. EXPO_PUBLIC_API_URL (set for builds / a hosted backend)
 * 2. In development on a device: the Metro host's LAN IP, so the phone can
 *    reach the backend running on the same computer.
 * 3. localhost (web, simulators).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:${API_PORT}`;

  // Android emulator maps the host machine to 10.0.2.2.
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  get isNetwork() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT';
  }
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Wired by the auth store so the client never imports app state directly. */
export function configureApiClient(opts: { getToken: TokenGetter; onUnauthorized: UnauthorizedHandler }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

export async function request<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = auth ? getToken() : null;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    throw new ApiError(
      0,
      aborted ? 'TIMEOUT' : 'NETWORK',
      aborted ? 'Сервер хариу өгсөнгүй. Дахин оролдоно уу.' : 'Интернэт холболтоо шалгана уу.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? 'Алдаа гарлаа.', e.details);
  }
  return data as T;
}

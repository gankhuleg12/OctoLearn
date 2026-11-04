const TOKEN_KEY = 'octolearn.admin.token';

export const session = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set token(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked — session lasts until reload */
    }
  },
  user: null,
};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/** Turns a zod issue list into one readable line. */
function describeValidation(details) {
  if (!Array.isArray(details) || details.length === 0) return null;
  return details.map((i) => i.message).join(' ');
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Сервертэй холбогдож чадсангүй.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error ?? {};
    const err = new ApiError(
      res.status,
      e.code ?? 'UNKNOWN',
      (e.code === 'VALIDATION_ERROR' && describeValidation(e.details)) || e.message || 'Алдаа гарлаа.',
      e.details,
    );
    if (res.status === 401 && session.token) onUnauthorized(err);
    throw err;
  }
  return data;
}

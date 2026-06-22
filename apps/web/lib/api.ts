import { emitToast } from '@/components/toaster';

let isRedirectingToLogin = false;
let refreshPromise: Promise<Session | null> | null = null;

declare global {
  interface Window {
    __LEADOPS_CONFIG__?: {
      apiUrl?: string;
    };
  }
}

type ApiOptions = RequestInit & {
  successMessage?: string;
  suppressToast?: boolean;
  skipAuthRefresh?: boolean;
};

type TokenRefreshResponse = Pick<Session, 'accessToken' | 'refreshToken'>;

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'BD' | 'CLOSER';
    status: 'ACTIVE' | 'INACTIVE';
  };
};

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('leadops.session');
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function setSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  if (!session) window.localStorage.removeItem('leadops.session');
  else window.localStorage.setItem('leadops.session', JSON.stringify(session));
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession();
  const { successMessage, suppressToast, skipAuthRefresh, ...requestOptions } = options;
  const response = await sendApiRequest(path, requestOptions, session?.accessToken);

  if (response.status === 401 && !skipAuthRefresh && session?.refreshToken && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const refreshedSession = await refreshSession(session);
    if (refreshedSession) {
      const retryResponse = await sendApiRequest(path, requestOptions, refreshedSession.accessToken);
      return handleApiResponse<T>(retryResponse, requestOptions, successMessage, suppressToast);
    }
  }

  return handleApiResponse<T>(response, requestOptions, successMessage, suppressToast);
}

async function sendApiRequest(path: string, requestOptions: RequestInit, accessToken?: string) {
  return fetch(`${apiUrl()}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...requestOptions.headers,
    },
  });
}

function apiUrl() {
  const value = typeof window !== 'undefined' ? window.__LEADOPS_CONFIG__?.apiUrl : process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('API URL is required');
  return value.replace(/\/$/, '');
}

async function handleApiResponse<T>(response: Response, requestOptions: RequestInit, successMessage?: string, suppressToast?: boolean): Promise<T> {
  if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const message = 'Session expired. Please log in again.';
    setSession(null);
    if (!isRedirectingToLogin) {
      isRedirectingToLogin = true;
      if (!suppressToast) emitToast({ type: 'error', title: 'Session expired', message });
      window.location.replace('/login');
    }
    throw new Error(message);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    if (!suppressToast) emitToast({ type: 'error', title: 'Request failed', message });
    throw new Error(message);
  }

  const method = (requestOptions.method ?? 'GET').toUpperCase();
  if (!suppressToast && ['POST', 'PATCH', 'DELETE'].includes(method)) {
    emitToast({ type: 'success', message: successMessage ?? 'Changes saved successfully.' });
  }

  return response.json() as Promise<T>;
}

async function refreshSession(session: Session): Promise<Session | null> {
  refreshPromise ??= requestTokenRefresh(session).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function requestTokenRefresh(session: Session): Promise<Session | null> {
  try {
    const response = await sendApiRequest(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      },
      undefined,
    );
    if (!response.ok) return null;
    const tokens = (await response.json()) as TokenRefreshResponse;
    const nextSession = { ...session, ...tokens };
    setSession(nextSession);
    return nextSession;
  } catch {
    return null;
  }
}

export function roleHome(role: Session['user']['role']) {
  if (role === 'SUPER_ADMIN') return '/admin/dashboard';
  if (role === 'BD') return '/bd/dashboard';
  return '/closer/dashboard';
}

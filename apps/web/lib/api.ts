import { emitToast } from '@/components/toaster';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
let isRedirectingToLogin = false;

type ApiOptions = RequestInit & {
  successMessage?: string;
  suppressToast?: boolean;
};

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
  const { successMessage, suppressToast, ...requestOptions } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...requestOptions.headers,
    },
  });

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

export function roleHome(role: Session['user']['role']) {
  if (role === 'SUPER_ADMIN') return '/admin/dashboard';
  if (role === 'BD') return '/bd/dashboard';
  return '/closer/dashboard';
}

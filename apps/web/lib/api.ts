const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message);
  }

  return response.json() as Promise<T>;
}

export function roleHome(role: Session['user']['role']) {
  if (role === 'SUPER_ADMIN') return '/admin/dashboard';
  if (role === 'BD') return '/bd/dashboard';
  return '/closer/dashboard';
}

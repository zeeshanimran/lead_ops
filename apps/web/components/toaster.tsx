'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

type ToastItem = ToastPayload & { id: string };

const toastEventName = 'leadops:toast';

export function emitToast(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(toastEventName, { detail: payload }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = crypto.randomUUID();
      const item = { ...detail, id };
      setToasts((current) => [...current, item].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, detail.duration ?? 4200);
    }

    window.addEventListener(toastEventName, onToast);
    return () => window.removeEventListener(toastEventName, onToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 top-4 z-[80] grid w-[min(420px,calc(100vw-32px))] gap-3">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const tone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
  }[toast.type];
  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : Info;
  const title = toast.title ?? (toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : 'Info');

  return (
    <section className={`flex items-start gap-3 rounded-lg border p-4 shadow-xl ${tone}`} role="status">
      <Icon className="mt-0.5 shrink-0" size={20} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-5">{toast.message}</p>
      </div>
      <button className="rounded-md p-1 opacity-70 hover:bg-white/50 hover:opacity-100" title="Dismiss notification" onClick={onClose}>
        <X size={16} />
      </button>
    </section>
  );
}

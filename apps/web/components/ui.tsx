import type { ButtonHTMLAttributes, ReactNode } from 'react';

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-lg border border-slate-200 bg-white p-5 shadow-panel', className)}>{children}</section>;
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'dark' | 'light' | 'danger' }) {
  const styles = {
    primary: 'bg-brand-red text-white hover:bg-red-700',
    dark: 'bg-neutral-950 text-white hover:bg-neutral-800',
    light: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200',
  };
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition', styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'red' | 'green' | 'yellow' | 'slate' | 'blue' }) {
  const styles = {
    red: 'bg-red-100 text-red-700',
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', styles[tone])}>{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-red/20 transition focus:border-brand-red focus:ring-4';

export const textareaClass = `${inputClass} resize-y leading-6`;

import type { ButtonHTMLAttributes, ReactNode } from 'react';

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 rounded-lg border border-slate-200 bg-white p-3.5 shadow-panel sm:p-4', className)}>{children}</section>;
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
      className={cn('inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition', styles[variant], className)}
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

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} aria-hidden="true" />;
}

export function MetricSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <Card className="p-0">
      <div className="table-wrap">
        <table className="lead-table">
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index}>
                  <Skeleton className="h-3 w-16 bg-slate-300" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, columnIndex) => (
                  <td key={columnIndex}>
                    <Skeleton className={columnIndex === 0 ? 'h-4 w-36' : 'h-4 w-24'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function DetailSkeleton() {
  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </Card>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <Skeleton className="mb-4 h-5 w-32" />
            <div className="grid gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </Card>
        ))}
      </div>
      <TableSkeleton columns={5} rows={3} />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  'min-h-9 min-w-0 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none ring-brand-red/20 transition focus:border-brand-red focus:ring-4';

export const textareaClass = `${inputClass} resize-y leading-5`;

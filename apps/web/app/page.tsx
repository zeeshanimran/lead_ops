'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, roleHome } from '@/lib/api';
import { Card, Skeleton } from '@/components/ui';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    router.replace(session ? roleHome(session.user.role) : '/login');
  }, [router]);

  return (
    <main className="grid min-h-screen min-w-0 place-items-center overflow-x-hidden bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-5">
          <p className="text-lg font-black tracking-tight">CodeBricks LeadOps</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Opening your workspace</p>
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    </main>
  );
}

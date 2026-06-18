import { AppShell } from '@/components/app-shell';

export default function CloserLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="CLOSER">{children}</AppShell>;
}

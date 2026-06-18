import { AppShell } from '@/components/app-shell';

export default function BdLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="BD">{children}</AppShell>;
}

import { CloserCallDetailPage } from '@/components/crm-pages';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CloserCallDetailPage id={id} />;
}

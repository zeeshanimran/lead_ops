'use client';

import { useSearchParams } from 'next/navigation';
import { CallsPage } from '@/components/crm-pages';
import type { CallStage, LeadCallStatus } from '@/types/domain';

const callStatuses: LeadCallStatus[] = ['SCHEDULED', 'COMPLETED', 'PENDING_FEEDBACK', 'NO_SHOW', 'RESCHEDULED', 'CANCELLED'];
const callStages: CallStage[] = ['SCREENING', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'FINAL', 'OFFERED'];

export default function Page() {
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const requestedStage = searchParams.get('stage');
  const status = callStatuses.find((value) => value === requestedStatus);
  const stage = callStages.find((value) => value === requestedStage);

  return <CallsPage role="SUPER_ADMIN" status={status} stage={stage} />;
}

import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getLegalConfig } from '@/lib/config/legal';
import { ImprintContent } from '@/components/legal/ImprintContent';

export const metadata: Metadata = {
  title: 'Imprint / Impressum - FamVacay',
};

export default async function ImprintPage() {
  // Render per request: operator details come from the runtime environment, not the build
  await connection();
  return <ImprintContent legal={getLegalConfig()} />;
}

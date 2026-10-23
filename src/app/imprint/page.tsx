import type { Metadata } from 'next';
import { getLegalConfig } from '@/lib/config/legal';
import { ImprintContent } from '@/components/legal/ImprintContent';

export const metadata: Metadata = {
  title: 'Imprint / Impressum - FamVacay',
};

export default function ImprintPage() {
  return <ImprintContent legal={getLegalConfig()} />;
}

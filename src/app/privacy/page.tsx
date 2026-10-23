import type { Metadata } from 'next';
import { getLegalConfig } from '@/lib/config/legal';
import { PrivacyContent } from '@/components/legal/PrivacyContent';

export const metadata: Metadata = {
  title: 'Privacy Policy / Datenschutzerklärung - FamVacay',
};

export default function PrivacyPage() {
  return <PrivacyContent legal={getLegalConfig()} />;
}

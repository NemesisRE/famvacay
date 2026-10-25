import type { Metadata } from 'next';
import { OfflineContent } from '@/components/pwa/OfflineContent';

export const metadata: Metadata = {
  title: 'Offline - FamVacay',
};

/** Shown by the service worker when a page cannot be loaded without a connection */
export default function OfflinePage() {
  return <OfflineContent />;
}

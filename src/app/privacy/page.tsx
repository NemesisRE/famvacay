import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getLegalConfig } from '@/lib/config/legal';
import { getPublicRuntimeConfig } from '@/lib/config/public-runtime';
import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { getConfiguredOAuthProviders } from '@/lib/auth/oauth-config';

export const metadata: Metadata = {
  title: 'Privacy Policy / Datenschutzerklärung - FamVacay',
};

export default async function PrivacyPage() {
  // Render per request: operator, hosting and analytics settings come from the runtime
  // environment, not the build
  await connection();
  return (
    <PrivacyContent
      legal={getLegalConfig()}
      analyticsEnabled={Boolean(getPublicRuntimeConfig().umamiWebsiteId)}
      oauthProviders={getConfiguredOAuthProviders()}
    />
  );
}

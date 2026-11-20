import type { Metadata } from 'next';
import { AboutContent } from '@/components/about/AboutContent';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { getRequestLocale } from '@/lib/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = dictionaries[await getRequestLocale()];
  return {
    title: { absolute: seo.aboutTitle },
    description: seo.aboutDescription,
    alternates: { canonical: '/about' },
    openGraph: { title: seo.aboutTitle, description: seo.aboutDescription, url: '/about' },
  };
}

export default function AboutPage() {
  return <AboutContent />;
}

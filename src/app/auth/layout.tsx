import type { Metadata } from 'next';

// Personal or sign-in pages: nothing for a search index (robots.txt also keeps crawlers out)
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';
import { AboutContent } from '@/components/about/AboutContent';

export const metadata: Metadata = {
  title: 'About - FamVacay',
  description: '100% AI-generated code, 100% human idea, design, architecture and testing: how FamVacay is built.',
};

export default function AboutPage() {
  return <AboutContent />;
}

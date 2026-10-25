import type { MetadataRoute } from 'next';

/** Web app manifest: makes FamVacay installable to the home screen (see public/sw.js for offline) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FamVacay - Family Vacation Optimizer',
    short_name: 'FamVacay',
    description:
      'Find the best family vacation windows around school holidays, public holidays, weather and prices.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#0d9488',
    categories: ['travel', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

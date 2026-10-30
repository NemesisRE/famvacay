/**
 * Node-runtime-only half of instrumentation.ts, split out per Next.js's
 * documented pattern so the Edge Runtime bundle never has to statically
 * analyze (and warn about) process.on/process.exit, which it doesn't support.
 */
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] Received ${signal}, closing database and cache connections...`);

  const [{ prisma }, { disconnectCache }] = await Promise.all([
    import('@/lib/db/prisma'),
    import('@/lib/cache/redis'),
  ]);

  const results = await Promise.allSettled([prisma.$disconnect(), disconnectCache()]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[shutdown] Error while closing a connection:', result.reason);
    }
  }

  console.log('[shutdown] Connections closed, exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Reference data (airports, routes, climate...) refreshes itself in the background; the JSON
// bundled in the repo is only the seed until the first refresh lands. Never awaited: register()
// must finish before the server accepts requests.
void import('@/lib/datasets/scheduler')
  .then(({ startDatasetRefreshScheduler }) => startDatasetRefreshScheduler())
  .catch((err) => console.warn('[datasets] could not start background refresh:', err?.message || err));

// Shared links are deleted 30 days after creation, as the privacy policy states
void import('@/lib/share/purge-expired-boards')
  .then(({ startExpiredBoardPurge }) => startExpiredBoardPurge())
  .catch((err) => console.warn('[share] could not start expired board purge:', err?.message || err));

// Passport expiry reminders by mail (only when SMTP is configured)
void import('@/lib/passport/reminders')
  .then(({ startPassportReminders }) => startPassportReminders())
  .catch((err) => console.warn('[passport] could not start expiry reminders:', err?.message || err));

/**
 * Runs once when a new Next.js server instance starts. Registers
 * SIGTERM/SIGINT handlers that drain the Prisma and Valkey/Redis connections
 * cleanly, so a `docker stop` or Komodo redeploy doesn't leave in-flight
 * queries or connections hanging during the container's stop grace period.
 *
 * Split into a Node-only sibling module (rather than inlining process.on /
 * process.exit here) so the Edge Runtime bundle, which this file also ships
 * to, never has to include APIs it doesn't support.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    require('./instrumentation-node');
  }
}

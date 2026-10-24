/**
 * Third-party sign-in credentials, read at runtime. Shared by the NextAuth providers and the
 * privacy policy, so the policy names exactly the providers that are actually enabled.
 * Apple accepts the documented APPLE_CLIENT_ID/APPLE_CLIENT_SECRET (.env.example) as well as
 * the older APPLE_ID/APPLE_SECRET names.
 */
type Env = Record<string, string | undefined>;
const read = (env: Env, ...names: string[]) => names.map((n) => env[n]?.trim()).find(Boolean);

export function getGoogleCredentials(env: Env = process.env) {
  const clientId = read(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = read(env, 'GOOGLE_CLIENT_SECRET');
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getAppleCredentials(env: Env = process.env) {
  const clientId = read(env, 'APPLE_CLIENT_ID', 'APPLE_ID');
  const clientSecret = read(env, 'APPLE_CLIENT_SECRET', 'APPLE_SECRET');
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getConfiguredOAuthProviders(env: Env = process.env): string[] {
  return [getGoogleCredentials(env) && 'Google', getAppleCredentials(env) && 'Apple'].filter(Boolean) as string[];
}

/** @type {import('next').NextConfig} */
function getAllowedOrigins() {
  const origins = ['localhost:3000', '127.0.0.1:3000'];
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.host && !origins.includes(parsed.host)) {
        origins.push(parsed.host);
      }
    } catch {
      // If it's a domain name without protocol
      const cleaned = appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (cleaned && !origins.includes(cleaned)) {
        origins.push(cleaned);
      }
    }
  }

  // Additional origins from comma-separated env if provided
  const extraOrigins = process.env.ALLOWED_ORIGINS;
  if (extraOrigins) {
    extraOrigins.split(',').forEach((o) => {
      const trimmed = o.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (trimmed && !origins.includes(trimmed)) {
        origins.push(trimmed);
      }
    });
  }

  return origins;
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },
};

module.exports = nextConfig;


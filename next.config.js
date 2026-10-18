const os = require('os');

/** @type {import('next').NextConfig} */
function getAllowedOrigins() {
  const origins = ['localhost:3000', '127.0.0.1:3000'];

  try {
    const ifaces = os.networkInterfaces();
    for (const name in ifaces) {
      for (const net of ifaces[name] || []) {
        if (net.family === 'IPv4') {
          const originWithPort = `${net.address}:3000`;
          if (!origins.includes(originWithPort)) {
            origins.push(originWithPort);
          }
        }
      }
    }
  } catch {
    // Non-critical network interface resolution
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.host && !origins.includes(parsed.host)) {
        origins.push(parsed.host);
      }
    } catch {
      const cleaned = appUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (cleaned && !origins.includes(cleaned)) {
        origins.push(cleaned);
      }
    }
  }

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src 'self' https://maps.google.com https://www.google.com https://www.openstreetmap.org",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

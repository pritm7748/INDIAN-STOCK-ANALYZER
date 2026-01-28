import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ============================================================
  // IMAGE OPTIMIZATION
  // ============================================================
  images: {
    remotePatterns: [
      {
        // Google OAuth profile pictures
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        // Google user content (alternative domain)
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        // Supabase storage (if you use it for avatars later)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },

  // ============================================================
  // LOGGING (helps with debugging)
  // ============================================================
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // ============================================================
  // SECURITY HEADERS
  // ============================================================
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            // Prevent clickjacking
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Prevent MIME type sniffing
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            // Control referrer information
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Permissions policy
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // ============================================================
  // REDIRECTS (Optional but useful)
  // ============================================================
  async redirects() {
    return [
      {
        // Redirect /watchlist to /dashboard (since watchlist needs an ID)
        source: '/watchlist',
        destination: '/dashboard',
        permanent: false,
      },
      {
        // Redirect /analyze to /dashboard
        source: '/analyze',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
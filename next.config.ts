import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security: hide the X-Powered-By response header
  poweredByHeader: false,

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Enable gzip compression for responses (Vercel also handles this at edge)
  compress: true,

  // Image optimization settings
  images: {
    // For now we use SVG and inline assets — no remote image domains needed.
    // Add remotePatterns here if player face images are added later.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fconline.nexon.com",
        pathname: "/live/externalAssets/**",
      },
    ],
  },

  // Native modules that should not be bundled by webpack/turbopack.
  // better-sqlite3 is a C++ addon that must remain external so Vercel's
  // build step can compile it for the correct platform (linux-x64).
  serverExternalPackages: ["better-sqlite3"],

  // Headers applied to all responses
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(ico|svg|png|jpg|jpeg|gif|webp|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Turbopack is the default bundler in Next.js 16+ (both local and Vercel).
  // No explicit config needed.
};

export default nextConfig;

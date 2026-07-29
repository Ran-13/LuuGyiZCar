import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the traced runtime deps, so the Docker
  // image does not need node_modules.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.eporner.com" },
      { protocol: "https", hostname: "static-ca-cdn.eporner.com" },
    ],
    // Thumbs top out at 640px wide; no point generating anything larger.
    imageSizes: [160, 240, 320, 427, 640],
    deviceSizes: [320, 420, 640, 750, 828, 1080],
    // Prefer modern formats — smaller files, faster loads.
    formats: ["image/avif", "image/webp"],
    // Keep optimized images cached longer (7 days).
    minimumCacheTTL: 604800,
  },
  // Compression is handled by nginx (gzip) — skip double-compression overhead
  // so the Node.js process responds faster.
  compress: false,
};

export default nextConfig;

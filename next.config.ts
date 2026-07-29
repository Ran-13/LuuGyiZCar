import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.eporner.com" },
      { protocol: "https", hostname: "static-ca-cdn.eporner.com" },
    ],
    // Thumbs top out at 640px wide; no point generating anything larger.
    imageSizes: [160, 240, 320, 427, 640],
    deviceSizes: [320, 420, 640, 750, 828, 1080],
  },
};

export default nextConfig;

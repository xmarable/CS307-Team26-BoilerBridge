import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone", // This is required for the standalone output to work correctly
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    // YOU CAN CHANGE THE LINK TO BE ANYTHING HERE IF YOU DONT LIKE THE ROUTE
    return [
      {
        source: "/dashboard/settings", // what you want it to be
        destination: "/user/me", // what the current route is (the page that actually exists)
      },
    ];
  },
  turbopack: {
    root: projectRoot,
  },
  webpack: (config, { dev, isServer }) => {
    // Fix for MongoDB/Mongoose Node modules leaking into client components
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        child_process: false,
        "timers/promises": false,
      };
    }

    // Polling is CPU-heavy on macOS; only enable for Docker/volume mounts when needed
    if (dev && !isServer && process.env.NEXT_WATCH_POLLING === "1") {
      config.watchOptions = {
        poll: 1000,
        ignored: /node_modules/,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;

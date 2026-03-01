import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
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

    // Existing: Only apply webpack polling in development mode to fix container sync
    if (dev && !isServer) {
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

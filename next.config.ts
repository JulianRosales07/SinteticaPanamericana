import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  allowedDevOrigins: [
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
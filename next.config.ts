import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/painel",
        destination: "/profile/me",
      },
      {
        source: "/jogar",
        destination: "/game",
      },
      {
        source: "/admin",
        destination: "/admin/index.html",
      },
      {
        source: "/painel-admin",
        destination: "/admin/index.html",
      },
    ];
  },
};

export default nextConfig;

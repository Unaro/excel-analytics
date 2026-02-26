import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  // Пустая конфигурация turbopack для silence ошибки
  // Turbopack используется по умолчанию в Next.js 16
  turbopack: {},
  // webpack конфиг оставляем для совместимости
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;

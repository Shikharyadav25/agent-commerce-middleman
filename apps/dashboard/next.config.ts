import type { NextConfig } from 'next';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${API_BASE}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

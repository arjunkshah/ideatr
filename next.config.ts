import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    // Point to local backend when deployed
    NEXT_PUBLIC_API_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'http://10.0.0.156:3001' 
      : 'http://localhost:3001'
  }
};

export default nextConfig;

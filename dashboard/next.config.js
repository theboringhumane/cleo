/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*', // Proxy to backend
      },
    ];
  },
  transpilePackages: ['@tremor/react'],
  images: {
    domains: ['localhost', 'github.com'],
  },
};

module.exports = nextConfig; 